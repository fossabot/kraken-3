#!/usr/bin/env python3
import os
import time
import logging
import datetime

from flask import Flask
from sqlalchemy.sql.expression import asc, desc, func, cast

import logs
from models import db, Executor, Run, Job
import consts

log = logging.getLogger('scheduler')


def assign_jobs_to_executors():
    counter = 0

    idle_executors = Executor.query.filter_by(job=None).all()
    if len(idle_executors) == 0:
        return 0
    idle_executors = {e.id: e for e in idle_executors}

    q = Job.query.filter_by(state=consts.JOB_STATE_QUEUED, executor_used=None)
    q = q.join('run')
    waiting_jobs = q.order_by(asc(Run.created), asc(Job.created)).all()  # FIFO
    if waiting_jobs:
        log.info('waiting jobs %s', waiting_jobs)

    for j in waiting_jobs:
        best_executor = None
        for e_id, e in idle_executors.items():
            if e.executor_group_id == j.executor_group_id:
                best_executor = e
                break
        if best_executor is None:
            continue
        idle_executors.pop(best_executor.id)

        best_executor.job = j
        j.executor_used = best_executor
        j.assigned = datetime.datetime.utcnow()
        db.session.commit()
        log.info("assigned job %s to executor %s", j, best_executor)

        counter += 1

        if len(idle_executors) == 0:
            break

    return counter


def create_app():
    logs.setup_logging('scheduler')

    # Create  Flask app instance
    app = Flask('Kraken Scheduler')

    # db url
    db_url = os.environ.get('DB_URL', "postgresql://kraken:kk123@localhost:5433/kraken")

    # Configure the SqlAlchemy part of the app instance
    app.config["SQLALCHEMY_ECHO"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # initialize SqlAlchemy
    db.init_app(app)
    db.create_all(app=app)

    return app


def main():
    app = create_app()

    with app.app_context():

        while True:
            t0 = time.time()
            jobs_cnt = assign_jobs_to_executors()
            t1 = time.time()

            dt = t1 - t0
            sleep_time = 5 - dt
            if sleep_time < 0:
                sleep_time = 0
            log.info("scheduled %d jobs in %.1fs, go sleep for %.1fs", jobs_cnt, dt, sleep_time)
            if sleep_time > 0:
                time.sleep(sleep_time)


if __name__ == "__main__":
    main()
