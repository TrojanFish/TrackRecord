import sys
import os
sys.path.append(os.getcwd())
from run_page.db import init_db
init_db("run_page/data.db")
print("Database initialized with segments and segment_efforts tables.")
