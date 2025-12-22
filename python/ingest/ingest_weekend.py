import os
import json
import numpy as np
import pandas as pd
import fastf1
from fastf1.core import Session

from common.db import get_conn

fastf1.Cache.enable_cache(os.path.join(os.getcwd(), ".fastf1_cache"))

def ms_from_timedelta(x) -> int | None:
  if pd.isna(x) or x is None:
    return None
  try:
    return int(x.total_seconds() * 1000)
  except Exception:
    return None

def downsample_by_distance(df: pd.DataFrame, n: int = 1200) -> pd.DataFrame:
  # expects columns: Distance, Speed, Throttle, Brake, nGear, DRS (where available)
  df = df.dropna(subset=["Distance"]).copy()
  if len(df) < 2:
    return df

  dist = df["Distance"].to_numpy()
  dmin, dmax = float(np.min(dist)), float(np.max(dist))
  if dmax <= dmin:
    return df

  grid = np.linspace(dmin, dmax, n)
  out = {"Distance": grid}

  def interp(col):
    if col not in df.columns:
      return None
    y = df[col].to_numpy()
    # handle all-NaN
    if np.all(pd.isna(y)):
      return None
    # fill gaps for interpolation
    s = pd.Series(y).interpolate(limit_direction="both").to_numpy()
    return np.interp(grid, dist, s)

  for col in ["Speed", "Throttle", "Brake", "nGear", "DRS", "X", "Y"]:
    y = interp(col)
    if y is not None:
      out[col] = y

  return pd.DataFrame(out)

def upsert_weekend(cur, season: int, rnd: int, name: str | None, circuit: str | None, date: str | None) -> int:
  cur.execute(
    """
    insert into weekends(season, round, name, circuit, date)
    values (%s,%s,%s,%s,%s)
    on conflict (season, round) do update
      set name=excluded.name, circuit=excluded.circuit, date=excluded.date
    returning id
    """,
    (season, rnd, name, circuit, date),
  )
  return cur.fetchone()[0]

def upsert_session(cur, weekend_id: int, session_code: str, start_time_utc) -> int:
  cur.execute(
    """
    insert into sessions(weekend_id, session_code, start_time_utc)
    values (%s,%s,%s)
    on conflict (weekend_id, session_code) do update
      set start_time_utc=excluded.start_time_utc
    returning id
    """,
    (weekend_id, session_code, start_time_utc),
  )
  return cur.fetchone()[0]

def upsert_driver(cur, code: str, name: str) -> int:
  cur.execute(
    """
    insert into drivers(code, name)
    values (%s,%s)
    on conflict (code) do update set name=excluded.name
    returning id
    """,
    (code, name),
  )
  return cur.fetchone()[0]

def ingest_session(season: int, rnd: int, session_code: str, telemetry_points: int = 1200):
  # session_code like "R", "Q", "FP1"
  s: Session = fastf1.get_session(season, rnd, session_code)
  
  # Get job_id from environment for progress tracking
  job_id = int(os.environ.get("JOB_ID", 0))
  if job_id:
    from common.progress import update_job_progress
    progress = {session_code: 20}
    update_job_progress(job_id, progress)
  
  s.load(telemetry=True, laps=True, weather=False, messages=False)
  
  if job_id:
    progress[session_code] = 40
    update_job_progress(job_id, progress)

  event_name = getattr(s.event, "EventName", None) or getattr(s.event, "EventName", None)
  circuit = getattr(s.event, "Location", None) or getattr(s.event, "Country", None)
  date = None
  try:
    date = str(s.date.date())
  except Exception:
    pass

  with get_conn() as conn:
    with conn.cursor() as cur:
      weekend_id = upsert_weekend(cur, season, rnd, event_name, circuit, date)
      session_id = upsert_session(cur, weekend_id, session_code, getattr(s, "date", None))

      # Results table (fastf1 provides s.results for many sessions)
      if getattr(s, "results", None) is not None and len(s.results) > 0:
        res = s.results.copy()
        for _, row in res.iterrows():
          code = str(row.get("Abbreviation") or row.get("DriverNumber") or "").strip()
          name = str(row.get("FullName") or row.get("Driver") or code).strip()
          if not code:
            continue
          driver_id = upsert_driver(cur, code, name)

          cur.execute(
            """
            insert into session_results(session_id, driver_id, position, best_lap_time_ms, status, points, grid)
            values (%s,%s,%s,%s,%s,%s,%s)
            on conflict (session_id, driver_id) do update set
              position=excluded.position,
              best_lap_time_ms=excluded.best_lap_time_ms,
              status=excluded.status,
              points=excluded.points,
              grid=excluded.grid
            """,
            (
              session_id,
              driver_id,
              int(row["Position"]) if pd.notna(row.get("Position")) else None,
              ms_from_timedelta(row.get("Q3")) or ms_from_timedelta(row.get("Time")) or None,
              str(row.get("Status")) if row.get("Status") is not None else None,
              float(row.get("Points")) if pd.notna(row.get("Points")) else None,
              int(row.get("GridPosition")) if pd.notna(row.get("GridPosition")) else None,
            ),
          )

      # Laps + key lap telemetry: pick personal best lap per driver if present
      laps = s.laps
      if laps is None or len(laps) == 0:
        conn.commit()
        return
      
      if job_id:
        progress[session_code] = 60
        update_job_progress(job_id, progress)

      for drv in laps["Driver"].dropna().unique():
        drv_laps = laps.pick_drivers(drv)
        if drv_laps is None or len(drv_laps) == 0:
          continue

        # choose "key lap": personal best if exists, else quickest LapTime
        key = drv_laps.pick_fastest()
        if key is None or pd.isna(key.get("LapNumber")):
          continue

        # driver info
        code = str(drv).strip()
        name = code
        try:
          name = str(key.get("Driver") or code)
        except Exception:
          pass
        driver_id = upsert_driver(cur, code, name)

        # store laps (limited: just a few, but we can store all lap rows too)
        for _, lr in drv_laps.iterrows():
          lap_no = lr.get("LapNumber")
          if pd.isna(lap_no):
            continue
          cur.execute(
            """
            insert into laps(session_id, driver_id, lap_number, lap_time_ms, compound, stint, is_personal_best)
            values (%s,%s,%s,%s,%s,%s,%s)
            on conflict (session_id, driver_id, lap_number) do update set
              lap_time_ms=excluded.lap_time_ms,
              compound=excluded.compound,
              stint=excluded.stint,
              is_personal_best=excluded.is_personal_best
            """,
            (
              session_id,
              driver_id,
              int(lap_no),
              ms_from_timedelta(lr.get("LapTime")),
              str(lr.get("Compound")) if lr.get("Compound") is not None else None,
              int(lr.get("Stint")) if pd.notna(lr.get("Stint")) else None,
              bool(lr.get("IsPersonalBest")) if lr.get("IsPersonalBest") is not None else None,
            ),
          )

        # telemetry
        tel = key.get_telemetry()
        if tel is None or len(tel) < 10:
          continue

        tel_ds = downsample_by_distance(tel, n=telemetry_points)

        def to_json_list(series):
          return np.round(series.astype(float), 6).tolist()

        def to_json(arr):
          return json.dumps(arr)

        payload = {
          "distance_m": to_json_list(tel_ds["Distance"]),
          "speed_kph": to_json_list(tel_ds["Speed"]) if "Speed" in tel_ds else None,
          "throttle": to_json_list(tel_ds["Throttle"]) if "Throttle" in tel_ds else None,
          "brake": to_json_list(tel_ds["Brake"]) if "Brake" in tel_ds else None,
          "gear": to_json_list(tel_ds["nGear"]) if "nGear" in tel_ds else None,
          "drs": to_json_list(tel_ds["DRS"]) if "DRS" in tel_ds else None,
          "pos_x": to_json_list(tel_ds["X"]) if "X" in tel_ds else None,
          "pos_y": to_json_list(tel_ds["Y"]) if "Y" in tel_ds else None,
        }

        cur.execute(
          """
          insert into telemetry_keylaps(session_id, driver_id, lap_number, n_points,
            distance_m, speed_kph, throttle, brake, gear, drs, pos_x, pos_y)
          values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
          on conflict (session_id, driver_id, lap_number) do update set
            n_points=excluded.n_points,
            distance_m=excluded.distance_m,
            speed_kph=excluded.speed_kph,
            throttle=excluded.throttle,
            brake=excluded.brake,
            gear=excluded.gear,
            drs=excluded.drs,
            pos_x=excluded.pos_x,
            pos_y=excluded.pos_y
          """,
          (
            session_id,
            driver_id,
            int(key["LapNumber"]),
            int(len(tel_ds)),
            to_json(payload["distance_m"]),
            to_json(payload["speed_kph"]) if payload["speed_kph"] else None,
            to_json(payload["throttle"]) if payload["throttle"] else None,
            to_json(payload["brake"]) if payload["brake"] else None,
            to_json(payload["gear"]) if payload["gear"] else None,
            to_json(payload["drs"]) if payload["drs"] else None,
            to_json(payload["pos_x"]) if payload["pos_x"] else None,
            to_json(payload["pos_y"]) if payload["pos_y"] else None,
          ),
        )

      # For race sessions, extract stint and position data
      if session_code == "R":
        # Process stints
        all_drivers = laps["Driver"].dropna().unique()
        for drv in all_drivers:
          drv_laps = laps.pick_drivers(drv)
          if drv_laps is None or len(drv_laps) == 0:
            continue
            
          code = str(drv).strip()
          driver_id = upsert_driver(cur, code, code)
          
          # Group consecutive laps by compound to identify stints
          stint_groups = []
          current_stint = None
          
          for _, lap in drv_laps.iterrows():
            compound = lap.get("Compound")
            lap_no = lap.get("LapNumber")
            
            if pd.notna(compound) and pd.notna(lap_no):
              if current_stint is None or current_stint["compound"] != compound:
                if current_stint:
                  stint_groups.append(current_stint)
                current_stint = {
                  "compound": str(compound),
                  "start_lap": int(lap_no),
                  "end_lap": int(lap_no)
                }
              else:
                current_stint["end_lap"] = int(lap_no)
          
          if current_stint:
            stint_groups.append(current_stint)
          
          # Insert stints
          for i, stint in enumerate(stint_groups):
            cur.execute(
              """
              insert into stints(session_id, driver_id, stint_number, compound, start_lap, end_lap, tire_age_at_start)
              values (%s,%s,%s,%s,%s,%s,%s)
              on conflict (session_id, driver_id, stint_number) do update set
                compound=excluded.compound,
                start_lap=excluded.start_lap,
                end_lap=excluded.end_lap
              """,
              (
                session_id,
                driver_id,
                i + 1,
                stint["compound"],
                stint["start_lap"],
                stint["end_lap"],
                0  # We don't have tire age data from FastF1
              ),
            )
        
        # Process lap positions
        for lap_no in range(1, int(laps["LapNumber"].max()) + 1):
          lap_data = laps[laps["LapNumber"] == lap_no].copy()
          if len(lap_data) == 0:
            continue
            
          # Sort by cumulative time to get positions
          lap_data["CumTime"] = pd.to_timedelta(lap_data["Time"]).dt.total_seconds() * 1000
          lap_data = lap_data.dropna(subset=["CumTime"]).sort_values("CumTime")
          
          if len(lap_data) > 0:
            leader_time = lap_data.iloc[0]["CumTime"]
            
            for pos, (_, row) in enumerate(lap_data.iterrows(), 1):
              drv = str(row["Driver"]).strip()
              driver_id = upsert_driver(cur, drv, drv)
              
              gap_to_leader = None if pos == 1 else int(row["CumTime"] - leader_time)
              interval = None
              if pos > 1:
                prev_time = lap_data.iloc[pos - 2]["CumTime"]
                interval = int(row["CumTime"] - prev_time)
              
              cur.execute(
                """
                insert into lap_positions(session_id, lap_number, driver_id, position, gap_to_leader_ms, interval_ms)
                values (%s,%s,%s,%s,%s,%s)
                on conflict (session_id, lap_number, driver_id) do update set
                  position=excluded.position,
                  gap_to_leader_ms=excluded.gap_to_leader_ms,
                  interval_ms=excluded.interval_ms
                """,
                (session_id, lap_no, driver_id, pos, gap_to_leader, interval),
        )

      conn.commit()
      
      if job_id:
        progress[session_code] = 95
        update_job_progress(job_id, progress)
