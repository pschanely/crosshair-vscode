
import re
import time

import icontract

@icontract.ensure(lambda result: result > 0)
def some_failing_function(x: int) -> int:
    # crosshair: on
    return x - 10

if __name__ == '__main__':
    pass
