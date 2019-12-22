import os
import time
import subprocess
import logging
import tempfile

log = logging.getLogger(__name__)

def _get_size(fname):
    with open(fname, "rb") as f:
        f.seek(0, 2)
        return f.tell()


def execute(cmd, timeout=60, cwd=None, env=None, output_handler=None, stderr=subprocess.STDOUT, tracing=True, raise_on_error=False,
            callback=None, cb_period=5):
    if cwd is None:
        cwd = os.getcwd()
    log.info("exec: '%s' in '%s'", cmd, cwd)

    with tempfile.NamedTemporaryFile(suffix=".txt", prefix="exec_") as fh:
        fname = fh.name

        p = subprocess.Popen(cmd,
                             shell=True,
                             text=True,
                             start_new_session=True,
                             env=env,
                             cwd=cwd,
                             stdout=fh,
                             stderr=stderr)

        # if 'clone' in cmd:
        #     from pudb.remote import set_trace
        #     set_trace(term_size=(208, 80))

        # read the output while process is working
        t_trace = t = time.time()
        t_cb = t - cb_period - 1  # force callback on first loop iteration
        t_end = t + timeout
        text = []
        out_size = 0
        completed = False
        with open(fname) as f:
            while t < t_end and not completed:
                t = time.time()

                # call callback if time passed
                dt = t - t_cb
                if callback and dt > cb_period:
                    t_cb = t
                    if callback(True):
                        log.info("callback requested stopping cmd %s", cmd)
                        break

                # handle output from subprocess
                out_fragment = ""
                s = _get_size(fname)
                ds = s - out_size
                out_size = s
                if ds > 0:
                    out_fragment = f.read(ds)
                if len(out_fragment) > 0:
                    if output_handler:
                        output_handler(out_fragment)
                    else:
                        text.append(out_fragment)
                    if tracing:
                        log.info("output: " + out_fragment.rstrip())

                # one trace for minute
                dt = t - t_trace
                if dt > 60:
                    t_trace = t
                    log.info("%s: %.2fsecs to terminate", cmd, int(t_end - t))


                completed = p.poll() is not None

            # read the rest of output
            out_fragment = f.read()
            if len(out_fragment) > 0:
                if output_handler:
                    output_handler(out_fragment)
                else:
                    text.append(out_fragment)
                if tracing:
                    log.info("output:\n%s", out_fragment)


    # check if there was timeout exceeded
    if t > t_end:
        log.info("cmd %s exceeded timeout (%dsecs)", cmd, timeout)

    # once again at the end check if it completed, if not terminate or even kill the process
    p.poll()
    if p.returncode is None:
        log.warn("terminating misbehaving cmd '%s'", cmd)
        p.terminate()
        for _ in range(10):
            if p.poll():
                break
            time.sleep(0.1)
        if p.poll() is None:
            log.warn("killing bad cmd '%s'", cmd)
            p.kill()
            for _ in range(10):
                if p.poll():
                    break
                time.sleep(0.1)

    # not good, cannot kill process
    if p.poll() is None:
        log.error("cannot kill cmd '%s'", cmd)

    if callback:
        callback(False)

    if output_handler is None:
        out = "".join(text)

    if raise_on_error and p.returncode != 0:
        raise Exception("cmd failed: %s, exitcode: %d, out: %s" % (cmd, p.returncode, out))

    # make sure that when there is error 'if retcode' turns True
    if p.returncode is None:
        retcode = -1
    else:
        retcode = p.returncode

    if output_handler is None:
        return retcode, out
    else:
        return retcode