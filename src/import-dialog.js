export const IMPORT_STAGES=['read','engine','geometry','render'];
const formatSeconds=ms=>(Math.max(0,ms)/1000).toFixed(1)+'s';
export const formatBytes=bytes=>{
  if(!Number.isFinite(bytes)||bytes<0)return '?';
  if(bytes<1024)return Math.round(bytes)+' B';
  const unit=bytes<1048576?'KB':'MB';
  const factor=unit==='KB'?1024:1048576;
  return (bytes/factor).toFixed(1)+' '+unit;
};

export function createImportDialog({
  dialog,filename,phase,detail,percent,bar,fill,elapsed,stepTime,stats,
  cancelButton,onCancel,clock=()=>performance.now(),
  startTimer=callback=>setInterval(callback,200),stopTimer=id=>clearInterval(id)
}) {
  const rows=[...dialog.querySelectorAll('[data-import-step]')];
  const states=new Map(IMPORT_STAGES.map(step=>[step,'pending']));
  let current=null,started=0,stageStarted=0,timer=null;
  const refreshTimer=()=>{
    if(!dialog.open)return;
    elapsed.textContent='Elapsed '+formatSeconds(clock()-started);
    stepTime.textContent='This step '+formatSeconds(clock()-stageStarted);
  };
  const refreshRows=()=>{
    for(const row of rows){
      const state=states.get(row.dataset.importStep)||'pending';
      row.dataset.state=state;
      const label=row.querySelector('.import-step-state');
      if(label)label.textContent={pending:'Waiting',active:'Working',done:'Done',skipped:'Skipped'}[state];
      if(state==='active')row.setAttribute('aria-current','step');
      else row.removeAttribute('aria-current');
    }
  };
  const meter=(fraction=null,description='Exact progress unavailable for this step')=>{
    if(fraction===null){
      bar.dataset.mode='indeterminate';
      bar.removeAttribute('aria-valuenow');
      bar.setAttribute('aria-valuetext',description);
      percent.textContent='Working';
      fill.style.width='34%';
      return;
    }
    const value=Math.max(0,Math.min(100,Math.round(fraction*100)));
    bar.dataset.mode='determinate';
    bar.setAttribute('aria-valuenow',String(value));
    bar.removeAttribute('aria-valuetext');
    percent.textContent=value+'%';
    fill.style.width=value+'%';
  };
  const close=()=>{
    if(timer!==null){stopTimer(timer);timer=null;}
    if(dialog.open)dialog.close();
    current=null;
  };
  cancelButton.addEventListener('click',onCancel);
  dialog.addEventListener('cancel',event=>{event.preventDefault();onCancel();});
  const api={
    begin(name,kind){
      close();
      filename.textContent=name;
      stats.hidden=true;stats.textContent='';
      started=clock();stageStarted=started;
      for(const stage of IMPORT_STAGES)states.set(stage,'pending');
      dialog.showModal();
      api.stage('read','Reading '+kind.toUpperCase()+' file…');
      refreshTimer();
      timer=startTimer(refreshTimer);
    },
    stage(name,message,{skip=[]}={}){
      if(!dialog.open)return;
      const index=IMPORT_STAGES.indexOf(name);
      if(index===-1)throw new Error('Unknown import stage: '+name);
      if(current===name){api.update(message);return;}
      for(let i=0;i<index;i++){
        const step=IMPORT_STAGES[i];
        if(states.get(step)==='pending')states.set(step,skip.includes(step)?'skipped':'done');
        if(states.get(step)==='active')states.set(step,'done');
      }
      states.set(name,'active');
      current=name;stageStarted=clock();
      phase.textContent=message;
      detail.textContent='The current operation does not expose a percentage.';
      meter();
      refreshRows();refreshTimer();
    },
    update(message){
      if(dialog.open)phase.textContent=message;
    },
    fileProgress(loaded,total){
      if(!dialog.open)return;
      const pct=total>0?loaded/total:1;
      meter(pct);
      phase.textContent='Reading file · '+Math.round(pct*100)+'%';
      detail.textContent=formatBytes(loaded)+' / '+formatBytes(total)+' loaded';
    },
    modelProgress(done,total){
      if(!dialog.open)return;
      const ratio=total>0?done/total:1;
      meter(ratio);
      phase.textContent='Building 3D view · '+done+' / '+total+' meshes';
      detail.textContent='Processed '+done+' of '+total+' model meshes';
    },
    metrics({meshes=0,faces=0,triangles=0}={}){
      if(!dialog.open)return;
      stats.hidden=false;
      stats.textContent=[
        meshes.toLocaleString('en-US')+' mesh'+(meshes===1?'':'es'),
        faces.toLocaleString('en-US')+' CAD faces',
        triangles.toLocaleString('en-US')+' triangles'
      ].join(' · ');
    },
    close
  };
  return api;
}
