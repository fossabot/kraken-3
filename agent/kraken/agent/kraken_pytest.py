import os
import logging
import xml.etree.ElementTree as ET

from . import utils
from . import tool

log = logging.getLogger(__name__)


def collect_tests(step):
    params = step.get('params', '')
    cwd = step.get('cwd', '.')
    cmd = 'pytest-3 --collect-only -q %s  | head -n -2' % params
    ret, out = utils.execute(cmd, cwd=cwd)
    tests = out
    tests = tests.splitlines()
    return tests


def run_tests(step, report_result=None):
    params = step.get('params', '')
    tests = step['tests']

    for test in tests:
        cwd = step.get('cwd', '.')
        params = [p for p in params.split() if p.startswith('-')]
        params = " ".join(params)
        cmd = 'pytest-3 -vv -r ap --junit-xml=result.xml %s %s' % (params, test)
        ret, out = utils.execute(cmd, cwd=cwd) # TODO: check ret

        result = dict(cmd=cmd, test=test)

        tree = ET.parse(os.path.join(cwd, 'result.xml'))
        root = tree.getroot()
        errors = int(root.get('errors'))
        failures = int(root.get('failures'))
        skips = int(root.get('skips'))
        if errors > 0:
            result['status'] = 3  # error
        elif failures > 0:
            result['status'] = 2  # failed
        elif skips > 0:
            result['status'] = 4  # disabled
        else:
            result['status'] = 1  # passed

        report_result(result)

    return 0, ''


if __name__ == '__main__':
    tool.main()