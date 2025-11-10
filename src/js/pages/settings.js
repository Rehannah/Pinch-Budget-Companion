// This file contains the logic for the settings page, including functions for exporting and importing data.

import { exportCSV, exportJSON, importJSON, clearAllData, resetForNewMonth, getState } from '../storage.js';

window.initSettings = async function(){
    document.getElementById('export-data').addEventListener('click', async ()=>{
        const csv = await exportCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'pinch-transactions.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    document.getElementById('import-file').addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(!file) return;
        const txt = await file.text();
        try{
            await importJSON(txt);
            alert('Data imported successfully');
        }catch(err){
            console.error(err); alert('Failed to import: '+err.message);
        }
    });

    // Save location UI
    const saveSelect = document.createElement('div');
    saveSelect.className = 'mt-4';
    saveSelect.innerHTML = `
        <label class="block text-sm mb-1">Save location</label>
        <select id="save-location" class="w-full p-2 border rounded">
            <option value="local">Device (IndexedDB)</option>
            <option value="download">Download (file)</option>
        </select>
        <label class="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" id="autosave-file"/> Auto-save to file when data changes</label>
    `;
    document.querySelector('main .max-w-lg').appendChild(saveSelect);

        const saveEl = document.getElementById('save-location');
        const autoEl = document.getElementById('autosave-file');
    const meta = (await getState()).meta || {};
    if(meta.saveLocation) saveEl.value = meta.saveLocation;
    if(meta.autoSaveToFile) autoEl.checked = !!meta.autoSaveToFile;

    saveEl.addEventListener('change', async ()=>{
        const val = saveEl.value;
        const { setSaveLocation } = await import('../storage.js');
        await setSaveLocation(val);
        alert('Save location updated');
    });

    autoEl.addEventListener('change', async ()=>{
        const val = autoEl.checked;
        const { setAutoSaveToFile } = await import('../storage.js');
        await setAutoSaveToFile(val);
        alert('Auto-save setting updated');
    });

        document.getElementById('restart-app').addEventListener('click', async ()=>{
            if(!confirm('This will clear transactions and start a new month. Continue?')) return;
            // friendly modal to collect month/base and optional categories (reuse onboarding pattern)
            const html = `
                <div class="space-y-2">
                    <label class="block text-sm">Month</label>
                    <input id="restart-month" type="month" class="w-full p-2 border rounded" />
                    <label class="block text-sm">Base budget</label>
                    <input id="restart-base" type="number" class="w-full p-2 border rounded" />
                    <label class="block text-sm">Add initial categories (optional)</label>
                    <div id="restart-cat-list" class="space-y-2"></div>
                    <button id="restart-add-cat" class="text-sm text-primary">+ Add category</button>
                </div>
            `;
            window.showModal({ title: 'Restart for new month', html, saveText: 'Restart', onSave: async ()=>{
                const month = document.getElementById('restart-month').value || null;
                const base = parseFloat(document.getElementById('restart-base').value) || 0;
                const rows = Array.from(document.getElementById('restart-cat-list').children || []);
                const cats = rows.map(r=>{ const inputs = r.querySelectorAll('input,select'); return { name: inputs[0].value||'Unnamed', limit: Number(inputs[1].value)||0, type: inputs[2].value||'expense' }; });
                await resetForNewMonth({ month, baseBudget: base, categories: cats });
                alert('App restarted for new month');
            }, onCancel: ()=>{}});
            // small helper to add rows
            function addRestartRow(name='', limit='', type='expense'){
                const row = document.createElement('div');
                row.className = 'flex gap-2 items-center';
                row.innerHTML = `<input class="flex-1 p-2 border rounded" placeholder="Category name" value="${name}" /><input class="w-24 p-2 border rounded" value="${limit}" /><select class="p-2 border rounded w-40"><option value="expense" ${type==='expense'?'selected':''}>Expense</option><option value="income" ${type==='income'?'selected':''}>Income</option></select><button class="text-red-500">Remove</button>`;
                const remove = row.querySelector('button'); remove.addEventListener('click', ()=>row.remove());
                document.getElementById('restart-cat-list').appendChild(row);
            }
            document.getElementById('restart-add-cat').addEventListener('click', ()=> addRestartRow());
        });

    // Dark mode toggle
    const dm = document.createElement('div');
    dm.className = 'mt-4';
    dm.innerHTML = `
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="dark-mode-toggle"/> Dark mode</label>
    `;
    document.querySelector('main .max-w-lg').appendChild(dm);
    const darkToggle = document.getElementById('dark-mode-toggle');
    if(meta.darkMode) darkToggle.checked = true;
    darkToggle.addEventListener('change', async ()=>{
        const on = darkToggle.checked;
        document.documentElement.classList.toggle('dark', on);
        const s = await getState(); s.meta.darkMode = on; await import('../storage.js').then(m=>m.saveState(s));
    });

    // show some info about current state
    const state = await getState();
    // TODO: present more settings (theme, backups)

        // Add XLSX export button (loads SheetJS on demand)
        const xlsxBtn = document.createElement('button');
        xlsxBtn.className = 'w-full bg-white border py-2 rounded';
        xlsxBtn.textContent = 'Export .xlsx (Excel)';
        document.querySelector('main .max-w-lg').appendChild(xlsxBtn);
        xlsxBtn.addEventListener('click', async ()=>{
            // load SheetJS dynamically
            if(!window.XLSX){
                await new Promise((resolve, reject)=>{
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
                });
            }
            const s = await getState();
            const rows = s.transactions.map(t=>({ date: (function(d){ if(!d) return ''; const dt = new Date(d); if(!isNaN(dt)){ const dd=String(dt.getDate()).padStart(2,'0'); const mm=String(dt.getMonth()+1).padStart(2,'0'); return `${dd}-${mm}-${dt.getFullYear()}` } return d;})(t.date), amount: t.amount, type: t.type, category: (s.categories.find(c=>c.id===t.categoryId)||{}).name || '', description: t.description }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pinch-transactions.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        });

        // File System Access API: choose file handle and save
        const fsDiv = document.createElement('div'); fsDiv.className = 'mt-4';
        fsDiv.innerHTML = `<button id="choose-save-file" class="w-full bg-white border py-2 rounded">Choose save file (optional)</button><button id="save-to-file" class="w-full bg-white border py-2 rounded mt-2">Save now to chosen file</button>`;
        document.querySelector('main .max-w-lg').appendChild(fsDiv);
        const chooseBtn = document.getElementById('choose-save-file');
        const saveBtn = document.getElementById('save-to-file');
        let _fileHandle = (state.meta && state.meta.fileHandle) ? state.meta.fileHandle : null;
        chooseBtn.addEventListener('click', async ()=>{
            if(window.showSaveFilePicker){
                try{
                    const handle = await window.showSaveFilePicker({ suggestedName: `pinch-backup-${(state.meta.month||'unspecified')}.json`, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
                    _fileHandle = handle;
                    // try saving handle to state (may or may not be cloneable in all browsers)
                    const st = await getState(); st.meta.fileHandle = handle; await import('../storage.js').then(m=>m.saveState(st));
                    alert('File selected');
                }catch(err){ console.error(err); alert('File pick cancelled or not supported'); }
            } else {
                alert('File System Access API not supported in this browser');
            }
        });
        saveBtn.addEventListener('click', async ()=>{
            if(!_fileHandle){ alert('No file selected. Choose a save file first.'); return; }
            try{
                const st = await getState();
                const writable = await _fileHandle.createWritable();
                await writable.write(JSON.stringify(st, null, 2));
                await writable.close();
                alert('Saved to file');
            }catch(err){ console.error(err); alert('Save failed: '+err.message); }
        });
}