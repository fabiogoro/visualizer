import numpy as np
import csv

class Midi:
    def __init__(self, path, name='', min_dur=225):
        f = open(path, 'r')
        parsed = csv.reader(f, delimiter=',')
        self.events = []
        self.path = path
        self.name = name
        for row in parsed:
            if row[2]==' Header':
                self.ppqn = int(row[5])
            if row[2]==' Tempo':
                self.tempo = int(row[3])
            if row[2]==' Note_on_c':
                time = int(row[1])
                note = int(row[4])
                is_on = bool(int(row[5]))
                if len(self.events)==0:
                    self.events.append([time, note, is_on])
                if self.events[-1][2]==True and is_on==True:
                    self.events.append([time,self.events[-1][1],False])
                if is_on==True:
                    if self.events[-1][0]-self.events[-2][0]<min_dur:
                        self.events.pop()
                        self.events.pop()
                    self.events.append([time, note, is_on])
                else:
                    if len(self.events)>0 and self.events[-1][1]==note:
                        if self.events[-1][2]==False:
                            self.events[-1] = [time,note,is_on]
                        else:
                            self.events.append([time, note, is_on])
            if row[2]==' Note_off_c':
                time = int(row[1])
                note = int(row[4])
                is_on = False
                if len(self.events)>0 and self.events[-1][1]==note:
                    if self.events[-1][2]==False:
                        self.events[-1] = [time,note,is_on]
                    else:
                        self.events.append([time, note, is_on])
        self.events = np.asarray(self.events)
        self.extract_features()
        self.prepare_queries()

    def extract_features(self):
        events = np.asarray(self.events)
        if(len(events)==0):
            start_times = np.asarray([])
            end_times = np.asarray([])
            self.duration = np.asarray([])
            end_notes = np.asarray([])
            start_notes = np.asarray([])
            self.pitch_interval = np.asarray([])
            self.pitch_interval_mod = np.asarray([])
            self.pitch_interval_fmod = np.asarray([])
            self.pitch_mod = np.asarray([])
            self.pitch = np.asarray([])
            self.ioir = np.asarray([])
            self.logioir = np.asarray([])
            return
        start_times = events[0::2,0]
        end_times = events[1::2,0]
        self.duration = end_times-start_times
        end_notes = events[1:-1:2,1]
        start_notes = events[2::2,1]
        self.pitch_interval = start_notes-end_notes
        self.countour = np.sign(start_notes-end_notes)
        self.pitch_interval_mod = (start_notes-end_notes)%12
        self.pitch_interval_fmod = np.fmod(start_notes-end_notes,12)
        self.pitch_mod = start_notes%12
        self.pitch = start_notes
        last = self.duration[0]
        self.ioir = []
        self.logioir = []
        for duration in self.duration[1:]:
            ioir = float(duration)/float(last)
            self.ioir.append(ioir)
            self.logioir.append(np.log2(ioir))
            last = duration

    def prepare_queries(self):
        zero = np.zeros(self.pitch_mod.shape)
        self.queries = {}
        self.queries['default'] = np.concatenate([self.pitch_interval_fmod, self.logioir])
        self.queries['chromalogioir'] = np.concatenate([self.pitch_mod, zero])
        self.queries['chromaint'] = np.concatenate([self.pitch_mod, self.pitch_interval])
        self.queries['chromaintfmod'] = np.concatenate([self.pitch_mod, self.pitch_interval_fmod])
        self.queries['chroma1d'] = np.concatenate([self.pitch_mod, zero])
        self.queries['piano1d'] = np.concatenate([self.pitch, zero])
        self.queries['intfmod1d'] = np.concatenate([self.pitch_interval_fmod, zero])
        self.queries['intmod1d'] = np.concatenate([self.pitch_interval_mod, zero])
        self.queries['int1d'] = np.concatenate([self.pitch_interval, zero])
        self.queries['ioir1d'] = np.concatenate([self.ioir, zero])
        self.queries['logioir1d'] = np.concatenate([self.logioir, zero])
        #self.queries['countour'] = np.concatenate([self.countour, zero])

    def get_query(self, qtype='default'):
        return self.queries[qtype]

