#!/usr/bin/env python3
"""Local Gate4 proof/render runner. Existing sources and approved graphics stay immutable."""
import argparse, hashlib, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / 'work/gate-4/revision-03'
EDL = json.loads((ROOT / 'episodes/2026-10/edit-decision-list-revision03.json').read_text())
CUES = json.loads((BASE / 'captions/caption-cues.json').read_text())['cues']
CLAIMS = json.loads((ROOT / 'episodes/2026-10/claims.json').read_text())['claims']
FONTDIR = ROOT / 'assets/brand/fonts'
ASSDIR = BASE / 'assembly-ass-full'
LAYOUT = {
 'phantom':dict(original='phantom.jpeg',start_frame=54,end_frame=174),
 'zero-fee':dict(original='zero-fee-carnival.jpeg',start_frame=90,end_frame=240),
 'hack':dict(original='bnb-hack.jpeg',start_frame=324,end_frame=475,opaque_until_join=True),
 'set-and-earn':dict(original='set-and-earn.jpeg',start_frame=42,end_frame=192),
 'bsc':dict(original='pasteur.jpeg',start_frame=384,end_frame=533,opaque_until_join=True),
 'tokenized-stocks':dict(original='tokenized-stocks-30b.jpeg',start_frame=76,end_frame=226),
}
PROOFS=[('welcome',3.0),('phantom',3.8),('zero-fee',8.8),('zero-fee',9.7),('hack',10.2),('agent-studio',14.6),('set-and-earn',4.8),('set-and-earn',20.2),('bsc',16.7),('rwa-tvl',6.5),('tokenized-stocks',6.0),('close',3.8),('close',8.2)]

def run(args, log):
    log.parent.mkdir(parents=True, exist_ok=True)
    log.with_suffix('.command.json').write_text(json.dumps(args,indent=2)+'\n')
    with log.open('w') as f:
        p = subprocess.run(args, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT)
    if p.returncode: raise RuntimeError(f'Command exited{p.returncode}; evidence: {log}')

def stamp(s):
    cs = round(s * 100); h,cs=divmod(cs,360000); m,cs=divmod(cs,6000); sec,cs=divmod(cs,100)
    return f'{h}:{m:02d}:{sec:02d}.{cs:02d}'

def ass_escape(text):
    return text.replace('\\','\\\\').replace('{','\\{').replace('}','\\}')

def make_ass(edit):
    section=edit['section'];duration=edit['duration_frames']/30;offset=edit['timeline_in_frame']/30
    header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Inter,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,140,140,92,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    events=[];maps=[]
    def event(a,z,style,txt):
        if z>a:events.append(f'Dialogue: 5,{stamp(a)},{stamp(z)},{style},,0,0,0,,{txt}')
    for cue in CUES:
        if cue['section']!=section:continue
        phrase=' '.join(cue['lines']);positions=[];cursor=0
        for w in cue['words']:
            disp=w['display'];start=w['start'];end=w['end'];parts=disp.split()
            for k,part in enumerate(parts):
                pos=phrase.find(part,cursor)
                if pos<0:raise RuntimeError('Caption phrase identity '+part)
                ta=start+(end-start)*k/len(parts);tz=start+(end-start)*(k+1)/len(parts)
                # Exact eligible group retains original separate aligned timing.
                if 'active_words' in w:
                    original=w['active_words'][k];ta=offset-edit['source_in_seconds']+original['start'];tz=offset-edit['source_in_seconds']+original['end']
                positions.append({'text':part,'from':pos,'to':pos+len(part),'start':ta,'end':tz});cursor=pos+len(part)
        boundaries=sorted(set([cue['start'],cue['end']]+[max(cue['start'],min(cue['end'],p[t])) for p in positions for t in ['start','end']]))
        for a,z in zip(boundaries[:-1],boundaries[1:]):
            if z-a<.005:continue
            active=next((p for p in positions if p['start']<=(a+z)/2<p['end']),None)
            text=phrase
            if active:text=text[:active['from']]+r'{\1c&H0BB9F0&}'+text[active['from']:active['to']]+r'{\1c&HFFFFFF&}'+text[active['to']:]
            # Restore the approved line wrap without changing text or highlight positions.
            if len(cue['lines'])>1:
                plain_break=len(cue['lines'][0]);visible=0;out='';tag=False
                for ch in text:
                    if ch=='{':tag=True
                    if not tag:
                        if visible==plain_break and ch==' ':out+=r'\N';visible+=1;continue
                        visible+=1
                    out+=ch
                    if ch=='}':tag=False
                text=out
            event(max(0,a-offset),min(duration,z-offset),'Caption',text)
            maps.append({'start_global':a,'end_global':z,'phrase':phrase,'active_word':active['text'] if active else None,'active_count':1 if active else 0})
    ASSDIR.mkdir(parents=True,exist_ok=True);path=ASSDIR/(section+'.ass');path.write_text(header+'\n'.join(events)+'\n')
    (ASSDIR/(section+'-active-word-map.json')).write_text(json.dumps(maps,indent=2)+'\n');return path

def escape_filter_path(path):
    return str(path).replace('\\','\\\\').replace(':','\\:').replace("'","\\'")

def graph(edit, proof_time=None):
    section=edit['section']; layout=LAYOUT.get(section,{});crop=None;ass=make_ass(edit)
    prefix='scale=1920:1080:flags=lanczos,setsar=1'
    if proof_time is None:
        original=edit.get('video_source_duration_frames',edit.get('source_duration_frames',edit['duration_frames']))
        prefix+=f",fps=30,trim=end_frame={original},setpts=PTS-STARTPTS"
        if edit.get('freeze_tail_frames'):prefix+=f",tpad=stop_mode=clone:stop_duration={edit['freeze_tail_frames']/30},trim=end_frame={edit['duration_frames']}"
    else:prefix+=f',setpts=PTS-STARTPTS+{proof_time}/TB'
    parts=[f'[0:v:0]{prefix}[base]']; current='base'
    if layout:
        # Complete original JPEG on a plain full-frame matte. This replaces both
        # the small-card layer and the old Hack-only stretched image.
        contain='scale=w=1760:h=780:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1,pad=1920:1080:(ow-iw)/2:40+(780-ih)/2:color=0x0B0E11,format=rgba'
        if proof_time is None:
            start=layout['start_frame']/30;end=layout['end_frame']/30
            fades=f',fade=t=in:st={start}:d={5/30}:alpha=1'
            if not layout.get('opaque_until_join'):
                fades+=f",fade=t=out:st={(layout['end_frame']-6)/30}:d={5/30}:alpha=1"
            parts.append(f"[1:v:0]setpts=PTS-STARTPTS,{contain}{fades}[originalart]")
            enable=f":enable='gte(t,{start})*lt(t,{end})'"
        else:
            parts.append(f'[1:v:0]{contain}[originalart]')
            enable='' if layout['start_frame']/30<=proof_time<layout['end_frame']/30 else ":enable='0'"
        parts.append(f"[base][originalart]overlay=x=0:y=0:eof_action=repeat{enable}[layer]");current='layer'
    suffix=''
    if proof_time is None and edit.get('fade_out_frames'):
        suffix=f",fade=t=out:st={edit['fade_out_start_frame']/30}:d={(edit['fade_out_frames']-1)/30}:color=0x0B0E11"
    parts.append(f"[{current}]ass=filename='{escape_filter_path(ass)}':fontsdir='{escape_filter_path(FONTDIR)}'{suffix},format=yuv420p[v]")
    return ';'.join(parts)

def proofs(only=None):
    out=BASE/'layout-proofs';out.mkdir(exist_ok=True)
    info=[]
    for section, source_time in PROOFS:
        if only and section != only:continue
        edit=next(e for e in EDL['edits'] if e['section']==section);local=source_time-edit['source_in_seconds']
        target=out/f'{section}-{source_time:.2f}.png'
        if target.exists(): raise RuntimeError('Proof collision: '+str(target))
        args=['ffmpeg','-hide_banner','-nostdin','-ss',str(source_time),'-i',edit['source']]
        if section in LAYOUT:args+=['-i',str(ROOT/'assets/news/2026-10'/LAYOUT[section]['original'])]
        args+=['-filter_complex',graph(edit,local),'-map','[v]','-frames:v','1','-update','1',str(target)]
        run(args,BASE/'proof-logs'/f'{section}-{source_time:.2f}.log')
        info.append({'section':section,'source_seconds':source_time,'local_seconds':local,'proof':str(target),'layout':LAYOUT.get(section,{})})
    if not only:(BASE/'layout-proof-index.json').write_text(json.dumps(info,indent=2)+'\n')
    (BASE/'final-layout.json').write_text(json.dumps(LAYOUT,indent=2)+'\n');print(json.dumps(info,indent=2))

def concat_quote(path):
    return "'"+str(path).replace("'","'\\''")+"'"

def image_proofs():
    """Short actual encoded windows, including transitions, before a full burn."""
    dest=BASE/'full-cut/image-proofs';dest.mkdir(exist_ok=False)
    info=[]
    for section,layout in LAYOUT.items():
        edit=next(e for e in EDL['edits'] if e['section']==section)
        first=max(0,layout['start_frame']-15)
        last=min(edit['duration_frames'],layout['end_frame']+15)
        segments=[]
        inputs=[(edit,first,last)]
        if layout.get('opaque_until_join'):
            neighbor=EDL['edits'][EDL['edits'].index(edit)+1]
            inputs.append((neighbor,0,15))
        for number,(e,a,z) in enumerate(inputs):
            target=dest/f'{section}-part{number}.mp4'
            wav=BASE.parent/'revision-02/assembly-render-01'/(e['section']+'.wav')
            if not wav.exists():raise RuntimeError('Existing normalized audio missing '+str(wav))
            args=['ffmpeg','-hide_banner','-nostdin','-threads','6','-ss',str(e['source_in_seconds']),'-i',e['source']]
            if e['section'] in LAYOUT:
                args+=['-loop','1','-framerate','30','-i',str(ROOT/'assets/news/2026-10'/LAYOUT[e['section']]['original'])]
                audio_index=2
            else:audio_index=1
            args+=['-i',str(wav)]
            filters=graph(e)+f';[v]trim=start_frame={a}:end_frame={z},setpts=PTS-STARTPTS[pv];[{audio_index}:a:0]atrim=start_sample={a*1600}:end_sample={z*1600},asetpts=PTS-STARTPTS[pa]'
            args+=['-filter_complex_threads','2','-filter_complex',filters,'-map','[pv]','-map','[pa]','-frames:v',str(z-a),'-t',str((z-a)/30),'-fps_mode','cfr','-r','30','-c:v','libx264','-preset','fast','-crf','18','-profile:v','high','-level:v','4.1','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-g','60','-threads','6','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-video_track_timescale','15360','-map_metadata','-1','-write_tmcd','0','-movflags','+faststart',str(target)]
            run(args,dest/f'{section}-part{number}.log')
            segments.append(target)
        if len(segments)==1:target=segments[0]
        else:
            target=dest/(section+'-with-next-take.mp4')
            args=['ffmpeg','-hide_banner','-nostdin','-i',str(segments[0]),'-i',str(segments[1]),'-filter_complex','[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a]','-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-video_track_timescale','15360','-map_metadata','-1','-movflags','+faststart',str(target)]
            run(args,dest/(section+'-join.log'))
        row={'section':section,'video':str(target),'source_local_first_frame':first,'source_local_last_frame_exclusive':last,'image_start_frame_in_proof':layout['start_frame']-first,'image_end_frame_in_proof_exclusive':layout['end_frame']-first,'frames':sum(z-a for e,a,z in inputs),'layout':layout,'original_source':str(ROOT/'assets/news/2026-10'/layout['original']),'no_crop_or_stretch':True,'caption_input':str(ASSDIR/(section+'.ass')),'next_take':inputs[1][0]['section'] if len(inputs)>1 else None}
        info.append(row)
        print('Encoded image proof '+section+' '+str(row['frames'])+' frames',flush=True)
    (dest/'index.json').write_text(json.dumps({'method':'Actual encoded original-source video, direct contained JPEG, same caption graph and exact reviewed speech waveform; short review windows only.','matte':'#0B0E11','image_bounds':{'x':80,'right':1840,'y':40,'bottom':820},'fade_frames':6,'proofs':info},indent=2)+'\n')
    (BASE/'full-cut/final-layout.json').write_text(json.dumps(LAYOUT,indent=2)+'\n')

def render(attempt, only=None):
    """Encode only selected speech. Copy approved visual packets and reuse decoded music content."""
    out=BASE/('assembly-render-'+attempt);out.mkdir(exist_ok=True)
    output=ROOT/'renders/gate-4/revision-03';output.mkdir(parents=True,exist_ok=True)
    target=output/'bnb-ecosystem-updates-2026-10-rough-cut.mp4'
    if target.exists():raise RuntimeError('Final render collision; preserve evidence before a new attempt')
    measurements=json.loads((BASE/'audio-normalization/measurements.json').read_text())
    commands=[];video_sources=[];audio_sources=[]
    for edit in EDL['edits']:
        if only and edit['section']!=only:continue
        section=edit['section']; duration=edit['duration_frames']/30; samples=edit['duration_frames']*1600
        source=pathlib.Path(edit['source'])
        if hashlib.sha256(source.read_bytes()).hexdigest()!=edit['source_sha256']:raise RuntimeError('Source hash mismatch '+section)
        wav=out/(section+'.wav')
        if wav.exists():
            if not only and (out/(section+'.mp4')).exists():
                audio_sources.append(wav);video_sources.append(out/(section+'.mp4'));print('Reusing exact reviewed section '+section,flush=True);continue
            raise RuntimeError('Audio collision: '+section)
        audio_args=['ffmpeg','-hide_banner','-nostdin']
        if 'source_id' in edit:audio_args+=['-ss',str(edit['source_in_seconds']),'-t',str(duration)]
        audio_args+=['-i',str(source),'-map','0:a:0','-vn']
        af=[]
        if 'source_id' in edit:
            m=measurements[section]
            af.append('loudnorm=I=-16:TP=-2:LRA=7:linear=true:measured_I='+m['input_i']+':measured_TP='+m['input_tp']+':measured_LRA='+m['input_lra']+':measured_thresh='+m['input_thresh']+':offset='+m['target_offset']+':print_format=json')
        if 'source_id' in edit:
            original_duration=edit.get('source_duration_frames',edit['duration_frames'])/30
            af += [f'atrim=end={original_duration}', 'afade=t=in:st=0:d=0.02', f'afade=t=out:st={original_duration-.02}:d=0.02']
        af+=['aresample=48000','aformat=sample_fmts=flt:channel_layouts=stereo',f'apad=whole_len={samples}',f'atrim=end_sample={samples}','asetpts=PTS-STARTPTS']
        audio_args+=['-af',','.join(af),'-c:a','pcm_f32le','-ar','48000','-ac','2',str(wav)]
        run(audio_args,out/(section+'-audio.log'));commands.append(audio_args);audio_sources.append(wav)
        if 'source_id' not in edit:
            video_sources.append(source);print('Reusing exact accepted '+section,flush=True);continue
        video=out/(section+'.mp4')
        if video.exists():raise RuntimeError('Video collision: '+section)
        args=['ffmpeg','-hide_banner','-nostdin','-threads','6','-ss',str(edit['source_in_seconds']),'-i',str(source)]
        if section in LAYOUT:args+=['-loop','1','-framerate','30','-i',str(ROOT/'assets/news/2026-10'/LAYOUT[section]['original'])]
        args+=['-filter_complex_threads','2','-filter_complex',graph(edit),'-map','[v]','-an','-frames:v',str(edit['duration_frames']),'-fps_mode','cfr','-r','30','-c:v','libx264','-preset','fast','-crf','18','-profile:v','high','-level:v','4.1','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-g','60','-threads','6','-video_track_timescale','15360','-map_metadata','-1','-write_tmcd','0','-movflags','+faststart',str(video)]
        run(args,out/(section+'-video.log'));commands.append(args);video_sources.append(video)
        print('Encoded selected '+section+' '+str(edit['duration_frames'])+'frames',flush=True)
    if only:
        print('Critical section encoded: '+str(out/(only+'.mp4')),flush=True);return
    video_list=out/'video-concat.txt'; audio_list=out/'audio-concat.txt'
    video_list.write_text('ffconcat version 1.0\n'+''.join('file '+concat_quote(p)+'\nduration '+f'{e["duration_frames"]/30:.10f}'+'\n' for p,e in zip(video_sources,EDL['edits'])))
    audio_list.write_text('ffconcat version 1.0\n'+''.join('file '+concat_quote(p)+'\n' for p in audio_sources))
    args=['ffmpeg','-hide_banner','-nostdin','-copyts','-f','concat','-safe','0','-i',str(video_list),'-f','concat','-safe','0','-i',str(audio_list),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-frames:v',str(EDL['duration_frames']),'-t',str(EDL['duration_frames']/30),'-avoid_negative_ts','disabled','-use_editlist','1','-map_metadata','-1','-write_tmcd','0','-movflags','+faststart','-video_track_timescale','15360',str(target)]
    run(args,out/'final-assembly.log');commands.append(args)
    (out/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
    (out/'assembly-policy.json').write_text(json.dumps({'approved_video':'Original accepted intro/outro packets stream-copied, never rendered again; compare decoded exact135/90frames in final QC.','approved_audio':'Decoded original48k stereo music/SFX content preserved without gains or fades; only final AAC192k delivery encoding, no extra music.','speech':'Source-identical retained words, measured two-pass16LUFS/-2dBTP normalization and20ms edge fades only in measured silent handles. Closing only8neutralframes forquietfade; genuineinitialquiet handle recovered. No eye/voice synthesis.','duration_frames':EDL['duration_frames'],'output':str(target)},indent=2)+'\n')
    print(str(target),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['proofs','image-proofs','render']);parser.add_argument('--only');parser.add_argument('--attempt',choices=['01','02'],default='01');args=parser.parse_args()
    if args.action=='proofs':proofs(args.only)
    elif args.action=='image-proofs':image_proofs()
    elif args.action=='render':render(args.attempt,args.only)
