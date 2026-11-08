import {parseViewBox,zoomViewBox,panViewBox,stringifyViewBox} from './preview-viewbox.js';

export function createPreviewZoom({
  source,openButton,dialog,viewport,caption,zoomValue,
  zoomInButton,zoomOutButton,fitButton,closeButton
}) {
  let svg=null,base=null,box=null,dragging=null;
  const render=()=>{
    if(!svg||!box)return;
    svg.setAttribute('viewBox',stringifyViewBox(box));
    zoomValue.textContent=Math.round(base.width/box.width*100)+'%';
  };
  const screenToSvg=(event)=>{
    if(!svg)return null;
    const matrix=svg.getScreenCTM();
    if(!matrix)return null;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    return {x:point.x,y:point.y};
  };
  const resetZoom=()=>{
    if(!base)return;
    box={...base};
    render();
  };
  const zoom=(factor,anchor)=>{
    if(!box)return;
    const oldRatio=base.width/box.width;
    const nextRatio=Math.min(32,Math.max(.5,oldRatio*factor));
    const point=anchor||{x:box.x+box.width/2,y:box.y+box.height/2};
    box=zoomViewBox(box,nextRatio/oldRatio,point);
    render();
  };
  const refresh=()=>{
    const original=source.querySelector('svg');
    openButton.disabled=!original;
    if(!dialog.open)return;
    if(!original){dialog.close();return;}
    svg=original.cloneNode(true);
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    viewport.replaceChildren(svg);
    base=parseViewBox(svg.getAttribute('viewBox'));
    caption.textContent=document.getElementById('previewCaption')?.textContent||'';
    dragging=null;
    resetZoom();
  };
  openButton.addEventListener('click',()=>{
    if(openButton.disabled||dialog.open)return;
    dialog.showModal();
    refresh();
    closeButton.focus();
  });
  closeButton.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',(event)=>{
    if(event.target===dialog)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    dragging=null;
    svg=null;
    viewport.replaceChildren();
  });
  fitButton.addEventListener('click',resetZoom);
  zoomInButton.addEventListener('click',()=>zoom(1.35));
  zoomOutButton.addEventListener('click',()=>zoom(1/1.35));
  viewport.addEventListener('wheel',(event)=>{
    if(!svg)return;
    event.preventDefault();
    const point=screenToSvg(event);
    zoom(Math.exp(-event.deltaY*.0015),point);
  },{passive:false});
  viewport.addEventListener('pointerdown',(event)=>{
    if(!svg||event.button!==0)return;
    const start=screenToSvg(event);
    if(!start)return;
    dragging={id:event.pointerId,start};
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  viewport.addEventListener('pointermove',(event)=>{
    if(!dragging||dragging.id!==event.pointerId||!box)return;
    const now=screenToSvg(event);
    if(!now)return;
    box=panViewBox(box,dragging.start.x-now.x,dragging.start.y-now.y);
    render();
  });
  const stopDrag=(event)=>{
    if(dragging?.id!==event.pointerId)return;
    dragging=null;
    if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup',stopDrag);
  viewport.addEventListener('pointercancel',stopDrag);
  viewport.addEventListener('lostpointercapture',()=>{dragging=null;});
  dialog.addEventListener('keydown',(event)=>{
    if(event.key==='+'||event.key==='='){zoom(1.35);event.preventDefault();}
    else if(event.key==='-'){zoom(1/1.35);event.preventDefault();}
    else if(event.key==='0'){resetZoom();event.preventDefault();}
    else if(box&&event.key.startsWith('Arrow')){
      const distance=box.width*.06,vertical=box.height*.06;
      const dirs={ArrowLeft:[-distance,0],ArrowRight:[distance,0],ArrowUp:[0,-vertical],ArrowDown:[0,vertical]};
      if(dirs[event.key]){box=panViewBox(box,...dirs[event.key]);render();event.preventDefault();}
    }
  });
  refresh();
  return {refresh};
}
