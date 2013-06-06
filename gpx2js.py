import sys
import re


coords = []
sampleCount = 255
for line in open(sys.argv[1],'r'):
    m = re.search('.*<trkpt lat="(\d*\.\d\d\d\d)\d*" lon="(\d*\.\d\d\d\d)\d*"/>.*', line)
    if (m):
       coords.append([m.group(1),m.group(2)])

s = '{"coords":['
if(len(coords) > sampleCount):
    stepWidth = len(coords) / float(sampleCount);
    for i in range(sampleCount):
        pos = int(i * stepWidth)
        if i != 0:
            s+= ','
        s+= '['+coords[pos][0] +','+coords[pos][1]+']'

else:
    for i in range(len(coords)):
        if i != 0:
            s+= ','
        s+= '['+coords[i][0] +','+coords[i][1]+']'

s+= ']}'
print s

