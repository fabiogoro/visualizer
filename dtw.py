import numpy as np
import librosa
import matplotlib.pyplot as plt
X = np.asarray([0,0,0,0,1,2,1])
Y = np.asarray([1,4,1])
D, wp = librosa.dtw(Y, X, subseq=True)
print(D,wp,D[-1, :] / wp.shape[0])
'''
plt.subplot(2, 1, 1)
librosa.display.specshow(D, x_axis='frames', y_axis='frames')
plt.title('Database excerpt')
plt.plot(wp[:, 1], wp[:, 0], label='Optimal path', color='y')
plt.legend()
plt.subplot(2, 1, 2)
plt.plot(D[-1, :] / wp.shape[0])
plt.xlim([0, Y.shape[1]])
plt.ylim([0, 2])
plt.title('Matching cost function')
plt.tight_layout()
'''
