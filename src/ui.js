function switchTab(tabId){document.querySelectorAll(".tab-content").forEach(e=>{e.classList.add("hidden")}),document.querySelectorAll(".tab").forEach(e=>{e.classList.remove("tab-active")}),document.getElementById(`panel-${tabId}`).classList.remove("hidden"),document.getElementById(`tab-${tabId}`).classList.add("tab-active")}function renderLiveInventory(){const e=document.getElementById("live-inventory-output");if(e.innerHTML="",""===state.liveInventory.length)return void(e.innerHTML='<p class="text-gray-500">Nenhum item coletado ainda. Adicione um item acima.</p>');const t=document.createElement("ul");t.className="divide-y divide-gray-200",state.liveInventory.forEach(a=>{const s=document.createElement("li");s.className="py-3 flex justify-between items-center",s.innerHTML=`
            <div>
                <span class="font-bold">${a.tombo||"SEM TOMBO"}</span> - ${a.item}
                <span class="block text-xs text-gray-500">${a.unidade} | ${a.local} | ${a.estado}</span>
            </div>
            <i class="fas fa-trash delete-btn" data-tombo="${a.tombo}"></i>
        `,s.querySelector(".delete-btn").addEventListener("click",handleDeleteLiveItem),t.appendChild(s)}),e.appendChild(t)}function renderComparisonResults(e){const t=document.getElementById("comparison-results");t.innerHTML=`
        ${createResultsTable("Itens Encontrados (Sistema x Inventário)",["Tombamento","Descrição","Responsavel","Local","Status"],e.found)}
        ${createResultsTable("Itens Faltantes no Inventário (Consta no Sistema)",["TOMBAMENTO","Descricao","Responsavel","DataUltimoMovimento","Status"],e.missingInInventory)}
        ${createResultsTable("Itens Sobrando no Inventário (Não Consta no Sistema)",["Tombo","Item","Unidade","Local","Estado"],e.missingInReport)}
    `,t.classList.remove("hidden")}function createResultsTable(e,t,a){if(0===a.length)return"";const s=t.map(e=>`<th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${e}</th>`).join(""),i=a.map(e=>{const a=t.map(t=>{const a=Object.keys(e).find(e=>e.toLowerCase()===t.toLowerCase().replace(/ /g,""))||t.toLowerCase();return`<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${e[a]||""}</td>`}).join("");return`<tr>${a}</tr>`}).join("");return`
        <div class="mt-8">
            <h3 class="text-xl font-semibold text-gray-800">${e} (${a.length})</h3>
            <div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200 mt-2">
                <thead><tr>${s}</tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">${i}</tbody>
            </table></div>
        </div>`}
