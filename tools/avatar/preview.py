import json, struct, sys, numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

def read_glb(path):
    b = open(path,'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; js = json.loads(b[20:20+jl])
    bl = struct.unpack('<I', b[20+jl:24+jl])[0]; bin_ = b[28+jl:28+jl+bl]
    def view(i): v = js['bufferViews'][i]; return bin_[v['byteOffset']:v['byteOffset']+v['byteLength']]
    DT = {5126: np.float32, 5123: np.uint16, 5121: np.uint8}
    N = {'SCALAR':1,'VEC3':3}
    def acc(i):
        a = js['accessors'][i]
        if 'bufferView' in a:
            arr = np.frombuffer(view(a['bufferView']), DT[a['componentType']]).reshape(a['count'], N[a['type']])
            return arr.copy()
        out = np.zeros((a['count'], N[a['type']]), np.float32)
        sp = a.get('sparse')
        if sp:
            idx = np.frombuffer(view(sp['indices']['bufferView']), DT[sp['indices']['componentType']])
            vals = np.frombuffer(view(sp['values']['bufferView']), np.float32).reshape(-1, 3)
            out[idx] = vals
        return out
    p = js['meshes'][0]['primitives'][0]
    return js, p, acc

def draw(ax, pos, tris, colors, view='front'):
    if view == 'front': X, Y, Z = pos[:,0], pos[:,1], pos[:,2]
    else: X, Y, Z = pos[:,2], pos[:,1], -pos[:,0]
    depth = Z[tris].mean(axis=1); order = np.argsort(depth)
    polys = np.stack([X[tris], Y[tris]], axis=2)[order]
    v0,v1,v2 = pos[tris[:,0]], pos[tris[:,1]], pos[tris[:,2]]
    n = np.cross(v1-v0, v2-v0); n /= np.linalg.norm(n,axis=1)[:,None]+1e-12
    light = np.array([0.3,0.4,0.85]) if view=='front' else np.array([0.85,0.4,-0.3])
    shade = np.clip(n @ (light/np.linalg.norm(light)), 0.15, 1)[order]
    c = colors[tris].mean(axis=1)[order] * shade[:,None]
    ax.add_collection(PolyCollection(polys, facecolors=np.clip(c,0,1), edgecolors='none'))
    ax.set_xlim(X.min()-.05, X.max()+.05); ax.set_ylim(-.02, Y.max()+.05); ax.set_aspect('equal'); ax.axis('off')

path, out = sys.argv[1], sys.argv[2]
js, p, acc = read_glb(path)
ext = p['extensions']['SPOTME_body']
pos = acc(p['attributes']['POSITION']); tris = acc(p['indices']).reshape(-1,3).astype(int)
parts = acc(p['attributes']['_PART'])[:,0]
names = js['meshes'][0]['extras']['targetNames']
targets = {n: acc(t['POSITION']) for n, t in zip(names, p['targets'])}
cmap = plt.get_cmap('tab20')
partc = np.array([cmap(i % 20)[:3] for i in parts])
skin = np.tile([0.77,0.62,0.52], (len(pos),1))
def zone_colors(keys, sign=1):
    c = skin.copy()
    for k in keys:
        z = ext['zones'][k]; i = acc(z['indices'])[:,0].astype(int); w = acc(z['weights'])[:,0]/255.0
        tgt = np.array([0.29,0.87,0.5]) if sign>0 else np.array([0.97,0.44,0.44])
        c[i] = c[i]*(1-w[:,None]) + tgt*w[:,None]
    return c
morphed = pos + 1.5*targets['bicepsL_incr'] + 1.0*targets['waist_decr'] + 1.0*targets['thighR_incr']
fig, axs = plt.subplots(1, 5, figsize=(25, 9), facecolor='#0f1115')
draw(axs[0], pos, tris, partc); axs[0].set_title('parts', color='w')
draw(axs[1], pos, tris, zone_colors(['neck','chest','waist','hips','bicepsL','forearmR','thighL','calfR','wristL','ankleR','kneeL','shoulders'])); axs[1].set_title('zones', color='w')
draw(axs[2], pos, tris, zone_colors(['upperAbdomen','lowerAbdomen','bicepsR','thighR'], -1)); axs[2].set_title('zones 2', color='w')
draw(axs[3], morphed, tris, zone_colors(['bicepsL','thighR']) ); axs[3].set_title('bicepsL+1.5 waist-1 thighR+1', color='w')
draw(axs[4], pos + targets['macro_weight_up'] + targets['macro_muscle_up'], tris, skin, view='side'); axs[4].set_title('weight+muscle up (side)', color='w')
plt.tight_layout(); plt.savefig(out, dpi=55, facecolor='#0f1115')
print('ok', pos.shape, tris.shape, ext['base']['heightCm'])
