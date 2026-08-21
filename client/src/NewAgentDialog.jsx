import { useRef, useEffect } from 'react';

// Pass `agent` (an existing agent object with name/state/region_name/area_code) to edit it.
// Omit `agent` (or pass null) to create a new one.
export default function NewAgentDialog({ open, onClose, onCreate, agent }) {
  const dialogRef = useRef(null);
  const isEdit = !!agent;

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
      id: agent?.id,
      name: form.name.value.trim(),
      state: form.state.value,
      region_name: form.region_name.value.trim(),
      area_code: form.area_code.value.trim().toUpperCase(),
    });
    if (!isEdit) form.reset();
  }

  return (
    <dialog ref={dialogRef} onCancel={onClose}>
      <form onSubmit={handleSubmit} key={agent?.id ?? 'new'}>
        <h2>{isEdit ? 'Update Agent' : 'New Agent'}</h2>
        <label>
          Agent Name
          <input name="name" required defaultValue={agent?.name || ''} />
        </label>
        <label>
          State
          <select name="state" defaultValue={agent?.state || 'MP'}>
            <option value="MP">MP (Madhya Pradesh)</option>
            <option value="CG">CG (Chhattisgarh)</option>
          </select>
        </label>
        <label>
          Region
          <input name="region_name" required placeholder="e.g. Jabalpur" defaultValue={agent?.region_name || ''} />
        </label>
        <label>
          Area Code
          <input name="area_code" required placeholder="e.g. A" defaultValue={agent?.area_code || ''} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit">{isEdit ? 'Save Changes' : 'Create'}</button>
        </div>
      </form>
    </dialog>
  );
}