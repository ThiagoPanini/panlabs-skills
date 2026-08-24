import json, sys, itertools, re, collections
EPS = 0.02  # inches tolerance

def rel(a, b):
    """relation of a to b"""
    ax1,ay1,ax2,ay2 = a['x1'],a['y1'],a['x2'],a['y2']
    bx1,by1,bx2,by2 = b['x1'],b['y1'],b['x2'],b['y2']
    ox = min(ax2,bx2)-max(ax1,bx1); oy = min(ay2,by2)-max(ay1,by1)
    if ox <= EPS or oy <= EPS: return 'DISJOINT'
    a_in_b = ax1>=bx1-EPS and ay1>=by1-EPS and ax2<=bx2+EPS and ay2<=by2+EPS
    b_in_a = bx1>=ax1-EPS and by1>=ay1-EPS and bx2<=ax2+EPS and by2<=ay2+EPS
    if a_in_b and b_in_a: return 'COINCIDENT'
    if a_in_b: return 'A_INSIDE_B'
    if b_in_a: return 'B_INSIDE_A'
    return 'CROSSES'

def kind(s):
    h=(s['text']+' '+s['name']).lower()
    st,d = s['stroke'], s['dash']
    if st=='00A4A6' and d in ('dash','sysDash'): return 'AZ'
    if re.search(r'availability\s*zone',h): return 'AZ'
    if st=='8C4FFF': return 'VPC'
    if re.search(r'private\s*subnet|public\s*subnet|\bsubnet\b',h): return 'SUBNET'
    if st in ('00A4A6','7AA116') and d in ('solid',None): return 'SUBNET'
    if st=='ED7100': return 'ASG'
    if st=='7D8998': return 'GENERIC'
    return None

def run(path,label):
    S=json.load(open(path))
    boxes=[]
    for s in S:
        k=kind(s)
        if k and s['w']>0.4 and s['h']>0.4:
            s['kind']=k; boxes.append(s)
    bysl=collections.defaultdict(list)
    for s in boxes: bysl[s['slide']].append(s)
    tally=collections.Counter()
    print("### %s — %d group boxes on %d slides" % (label,len(boxes),len(bysl)))
    for sl,v in sorted(bysl.items()):
        for a,b in itertools.combinations(v,2):
            if a['kind']==b['kind']: continue
            r=rel(a,b)
            pair=tuple(sorted([a['kind'],b['kind']]))
            if r=='DISJOINT': continue
            # normalise direction
            if r=='A_INSIDE_B': desc="%s inside %s" % (a['kind'],b['kind'])
            elif r=='B_INSIDE_A': desc="%s inside %s" % (b['kind'],a['kind'])
            elif r=='CROSSES': desc="%s CROSSES %s" % tuple(sorted([a['kind'],b['kind']]))
            else: desc="%s coincident %s" % tuple(sorted([a['kind'],b['kind']]))
            tally[desc]+=1
            if 'AZ' in pair and ('VPC' in pair or 'SUBNET' in pair) or pair==('SUBNET','VPC'):
                print("   slide %-3s %-28s  a=%-22s b=%s" % (sl,desc,a['text'][:20] or a['name'][:20], b['text'][:20] or b['name'][:20]))
    print("   --- tally ---")
    for k,v in sorted(tally.items(), key=lambda z:-z[1]): print("   %-34s %d" % (k,v))
    print()

run('/home/paninit/.claude/jobs/47a6cacc/tmp/azvpc/shapes.json','DECK (AWS Architecture Icons, 156 slides)')
run('/home/paninit/.claude/jobs/47a6cacc/tmp/azvpc/sra_shapes.json','SRA (published multi-account RA, 16 slides)')
