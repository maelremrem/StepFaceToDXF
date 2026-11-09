export function createImportDialog({dialog,filename,phase,cancelButton,onCancel}) {
  const close=()=>{if(dialog.open)dialog.close();};
  cancelButton.addEventListener('click',onCancel);
  dialog.addEventListener('cancel',event=>{
    event.preventDefault();
    onCancel();
  });
  return {
    begin(name,kind) {
      filename.textContent=name;
      phase.textContent='Reading '+kind.toUpperCase()+' file…';
      if(!dialog.open)dialog.showModal();
    },
    update(message) {
      if(dialog.open)phase.textContent=message;
    },
    close
  };
}
