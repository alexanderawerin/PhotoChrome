import json, pathlib, subprocess
root=pathlib.Path('/workspace/artifacts/photochrome-guideline-refinement')
source=root/'recordings/mobile.webm'
chapters=json.loads((root/'chapters.json').read_text())
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(source)]))
duration=float(probe['format']['duration'])
trim=max(0,chapters[0]['at']-.4)
length=duration-trim
def ts(t): return f'{int(t//3600)}:{int(t%3600//60):02}:{t%60:05.2f}'
ass='''[Script Info]
ScriptType: v4.00+
PlayResX: 786
PlayResY: 1784
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,25,&H00EEEDED,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,16,16,26,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
for i,c in enumerate(chapters):
 start=max(0,c['at']-trim)
 end=chapters[i+1]['at']-trim if i+1<len(chapters) else length
 label=c['label'] if i else 'PhotoChrome · эмуляция мобильного браузера'
 ass+=f'Dialogue: 0,{ts(start)},{ts(end)},Default,,0,0,0,,{label}\n'
(root/'captions.ass').write_text(ass)
# No retiming or fabricated screens: trim only startup, preserve the full
# running viewport and add readable chapter captions outside the interface.
vf=f'trim=start={trim},setpts=PTS-STARTPTS,scale=786:1704:flags=lanczos:in_range=full:out_range=tv,pad=786:1784:0:0:color=0x101113,setsar=1,fps=25,ass={root}/captions.ass'
output=root/'PhotoChrome-mobile-guidelines.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-vf',vf,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],check=True)
(root/'encoding.json').write_text(json.dumps({'source':str(source),'sourceProbe':probe,'trimSeconds':trim,'duration':length,'output':str(output)},indent=2))
print(json.dumps({'output':str(output),'duration':length,'bytes':output.stat().st_size}))
