from midicsv import *
import sys
import json

query = Midi(sys.argv[1],'00001',1)
print(json.dumps({'res': query.events.tolist(), 'trans': query.events.tolist()}))
