from midicsv import *
import qbhlib as ql
import glob
from multiprocessing import Pool
import time
from math import ceil
import sys
import json

def updatequeue(S, best, K, track):
    for i in range(K):
        if S[i]['score'] < best:
            S.insert(i,{'score': best, 'track': track})
            S.pop()
            return

DB = []
dbfiles = glob.glob("csvFile/*.csv")
for file in dbfiles:
    DB.append(Midi(file, file[-13:-8]))

def search_query(query):
    qtype='int1d'
    Q = query.get_query(qtype)
    if len(Q)>4:
        K = 10
        S = []
        for pos in range(K):
            S.append({'score':0,'track': '0'})
        for song in DB:
            best = 0
            X = song.get_query(qtype)
            best = ql.smbgt(Q, X, 15, 15, 1.1, 0.3, 0.25, 1.0, 0)
            updatequeue(S, best, K, song)
        print(json.dumps(S[0]['track'].events.tolist()))

search_query(Midi(sys.argv[1],'00001'))
