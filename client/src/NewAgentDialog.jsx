import { useRef, useEffect } from 'react';

export default function NewAgentDialog({ open, onClose, onCreate }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    onCreate({
      name: form.name.value.trim(),
      state: form.state.value,
      region_name: form.region_name.value.trim(),
      area_code: form.area_code.value.trim().toUpperCase(),
    });
    form.reset();
  }

  return (
    <dialog ref={dialogRef} onCancel={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>New Agent</h2>
        <label>
          Agent Name
          <input name="name" required />
        </label>
        <label>
          State
          <select name="state" defaultValue="MP">
            <option value="MP">MP (Madhya Pradesh)</option>
            <option value="CG">CG (Chhattisgarh)</option>
          </select>
        </label>
        <label>
          Region
          <input name="region_name" required placeholder="e.g. Jabalpur" />
        </label>
        <label>
          Area Code
          <input name="area_code" required placeholder="e.g. A" />
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit">Create</button>
        </div>
      </form>
    </dialog>
  );
}