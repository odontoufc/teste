// app.js

// Configuração Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCtPyXA4TJMvxeX3vNdelzvADQTyzVRCfw",
    authDomain: "guia-clinico-odonto.firebaseapp.com",
    projectId: "guia-clinico-odonto",
    storageBucket: "guia-clinico-odonto.firebasestorage.app",
    messagingSenderId: "734059654891",
    appId: "1:734059654891:web:a0f4168725066b054d58ae",
    measurementId: "G-5287NREP2D"
};

let db;
let auth;
let isFirebaseActive = false;

// Inicialização Firebase
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        isFirebaseActive = true;
        console.log("Firebase e Auth conectados!");
    } else {
        console.warn("SDK Firebase não carregado.");
    }
} catch (e) {
    console.error("Erro Firebase:", e);
}

// Inicializa ícones
if (typeof lucide !== 'undefined') lucide.createIcons();

let isAdmin = false;
let contentCache = {};
let currentFilter = 'all';

// --- SISTEMA DE AUTENTICAÇÃO ---
if (isFirebaseActive) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            isAdmin = true;
            document.getElementById('admin-badge').classList.remove('hidden');
            console.log("Admin logado:", user.email);
        } else {
            isAdmin = false;
            document.getElementById('admin-badge').classList.add('hidden');
        }
        renderBlog(); 
    });
}

function toggleAdmin() {
    if (isAdmin) {
        if(confirm("Deseja sair do modo administrador?")) {
            auth.signOut().then(() => {
                alert("Logout realizado com sucesso.");
                navigateTo('home');
            }).catch((error) => {
                console.error("Erro ao sair", error);
            });
        }
    } else {
        document.getElementById('admin-modal').classList.remove('hidden');
    }
}

function performLogin() {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;
    
    if (!email || !pass) {
        alert("Preencha e-mail e senha.");
        return;
    }

    const btn = document.querySelector('#admin-modal button:last-child');
    const originalText = btn.innerText;
    btn.innerText = "Entrando...";
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            document.getElementById('admin-modal').classList.add('hidden');
            document.getElementById('admin-email').value = '';
            document.getElementById('admin-pass').value = '';
            loadSiteContent();
        })
        .catch((error) => {
            let msg = "Erro ao entrar.";
            if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
            if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
            if (error.code === 'auth/invalid-email') msg = "E-mail inválido.";
            alert(msg);
        })
        .finally(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        });
}

// --- MODO ESCURO ---
function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Verifica preferência
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

// --- EDITOR WYSIWYG ---
function execCmd(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('editor-content').focus();
}

const editorContent = document.getElementById('editor-content');
if (editorContent) {
    editorContent.addEventListener('paste', function(e) {
        e.preventDefault();
        var text = (e.originalEvent || e).clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });
    
    editorContent.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            e.shiftKey ? document.execCommand('outdent') : document.execCommand('indent');
        }
    });
}

// --- LÓGICA DE DADOS ---
async function loadSiteContent() {
    let localData = [];
    try {
        const stored = localStorage.getItem('gc_protocols');
        if (stored) localData = JSON.parse(stored);
    } catch (e) { console.error("Erro localStorage:", e); }

    localData.forEach(item => contentCache[item.id] = item);
    
    if (isFirebaseActive) {
        try {
            const snapshot = await db.collection('protocols').get();
            snapshot.forEach(doc => {
                contentCache[doc.id] = { id: doc.id, ...doc.data() };
            });
        } catch(e) { console.error("Erro Firebase:", e); }
    }

    // Carrega defaultData (vindo do data.js)
    if (typeof defaultData !== 'undefined') {
        defaultData.forEach(item => {
            const systemIds = [
                'dentistica-siglas', 'dentistica-materiais', 'dentistica-exemplos', 'dentistica-odontograma',
                'periodontia-siglas', 'periodontia-exemplos', 'periodontia-materiais',
                'endodontia-siglas', 'endodontia-exemplos', 'endodontia-materiais',
                'cirurgia-siglas', 'cirurgia-exemplos', 'cirurgia-materiais',
                'prescricoes-geral', 'links-uteis'
            ];
            
            if (systemIds.includes(item.id) || !contentCache[item.id]) {
                contentCache[item.id] = item;
            }
        });
    }

    // Atualiza o ano
    const yearEl = document.getElementById('copyright-year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();

    updateUI();
}

function setFilter(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    const btnId = category === 'all' ? 'filter-all' : `filter-${category.toLowerCase().replace('í','i').replace('á','a')}`;
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
    
    renderBlog();
}

function updateUI() {
    if (document.getElementById('view-blog') && document.getElementById('view-blog').classList.contains('active')) {
        renderBlog();
    }
    
    const specialties = ['dentistica', 'periodontia', 'endodontia', 'cirurgia'];
    specialties.forEach(spec => {
        const view = document.getElementById(`view-${spec}`);
        if (view && view.classList.contains('active')) {
                const activeSection = document.querySelector(`#prontuario-menu-${spec}.hidden`) ? document.querySelector(`#dynamic-content-area-${spec}:not(.hidden)`) : null;
                if(activeSection) {
                hideProntuarioSections(spec); 
                }
                renderInstrumentais(spec);
                const protocolsTab = document.getElementById(`tab-${spec}-protocolos`);
                if(protocolsTab && protocolsTab.classList.contains('active')) {
                    renderSpecialtyProtocols(spec);
                }
        }
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderBlog() {
    const grid = document.getElementById('blog-grid');
    if(!grid) return;

    const term = document.getElementById('search-input').value.toLowerCase();
    grid.innerHTML = '';
    
    let protocols = Object.values(contentCache).filter(item => item.summary);
    
    if(term) {
        protocols = protocols.filter(p => 
            p.title.toLowerCase().includes(term) || 
            p.category.toLowerCase().includes(term) ||
            (p.summary && p.summary.toLowerCase().includes(term))
        );
    }

    if (currentFilter !== 'all') {
        protocols = protocols.filter(p => p.category === currentFilter);
    }

    protocols.sort((a, b) => a.title.localeCompare(b.title));
    
    const msg = document.getElementById('no-protocols-msg');
    if (protocols.length === 0) {
        if(msg) msg.classList.remove('hidden');
        return;
    } else {
        if(msg) msg.classList.add('hidden');
    }

    if (currentFilter === 'all' && !term) {
        const grouped = {};
        protocols.forEach(p => {
            if (!grouped[p.category]) grouped[p.category] = [];
            grouped[p.category].push(p);
        });

        const catOrder = ['Dentística', 'Periodontia', 'Endodontia', 'Cirurgia', 'Geral'];
        
        catOrder.forEach(cat => {
            if (grouped[cat] && grouped[cat].length > 0) {
                const sectionTitle = document.createElement('div');
                sectionTitle.className = "flex items-center gap-2 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700";
                sectionTitle.innerHTML = `<h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">${cat}</h3>`;
                grid.appendChild(sectionTitle);

                const sectionGrid = document.createElement('div');
                sectionGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-4 pt-2";
                
                grouped[cat].forEach(post => {
                    sectionGrid.appendChild(createProtocolCard(post));
                });
                grid.appendChild(sectionGrid);
            }
        });
        
        Object.keys(grouped).forEach(cat => {
            if (!catOrder.includes(cat)) {
                    const sectionTitle = document.createElement('div');
                sectionTitle.className = "flex items-center gap-2 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700";
                sectionTitle.innerHTML = `<h3 class="text-lg font-bold text-gray-800 dark:text-gray-200">${cat}</h3>`;
                grid.appendChild(sectionTitle);

                const sectionGrid = document.createElement('div');
                sectionGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-4 pt-2";
                grouped[cat].forEach(post => sectionGrid.appendChild(createProtocolCard(post)));
                grid.appendChild(sectionGrid);
            }
        });

    } else {
        const sectionGrid = document.createElement('div');
        sectionGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
        protocols.forEach(post => {
            sectionGrid.appendChild(createProtocolCard(post));
        });
        grid.appendChild(sectionGrid);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    const btnNew = document.getElementById('btn-new-protocol');
    if(btnNew) btnNew.classList.toggle('hidden', !isAdmin);
}

function createProtocolCard(post) {
    const card = document.createElement('div');
    card.className = "bg-white dark:bg-gray-800 dark:border-gray-700 p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col h-full";
    card.onclick = () => openPost(post.id);
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-bold text-primary dark:text-cyan-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">${post.category}</span>
        ${isAdmin ? `<button onclick="event.stopPropagation(); openEditor('${post.id}')" class="text-gray-400 hover:text-blue-600"><i data-lucide="edit-2" class="w-4 h-4"></i></button>` : ''}</div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">${post.title}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 flex-grow">${post.summary || ''}</p>
        <div class="flex items-center text-primary dark:text-cyan-400 text-sm font-medium mt-auto">Ler protocolo <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i></div>
    `;
    return card;
}

function renderInstrumentais(specialty) {
    const id = `${specialty}-materiais`;
    const data = contentCache[id] || { content: '<p class="text-gray-400 italic">Conteúdo não cadastrado.</p>' };
    const container = document.getElementById(`instrumentais-list-${specialty}`);
    if(container) container.innerHTML = data.content;
}

function renderSpecialtyProtocols(specialty) {
    const categoryMap = { 'dentistica': 'Dentística', 'periodontia': 'Periodontia', 'endodontia': 'Endodontia', 'cirurgia': 'Cirurgia' };
    const categoryName = categoryMap[specialty];
    const container = document.getElementById(`protocolos-list-${specialty}`);
    if(!container) return;

    let protocols = Object.values(contentCache).filter(p => 
        p.category === categoryName && p.summary && 
        !['siglas', 'materiais', 'exemplos', 'odontograma'].some(suffix => p.id.includes(suffix))
    );
    
    if (protocols.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4 text-sm italic">Nenhum protocolo cadastrado.</p>';
        return;
    }

    protocols.sort((a, b) => a.title.localeCompare(b.title));
    
    container.innerHTML = '';
    protocols.forEach(post => {
        const btn = document.createElement('button');
        btn.className = "w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary hover:bg-blue-50 dark:hover:bg-gray-700 transition flex items-center gap-4 text-left group bg-white dark:bg-gray-800 shadow-sm";
        btn.onclick = () => openPost(post.id, null, specialty);
        btn.innerHTML = `
            <div class="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-full text-primary dark:text-cyan-400 shrink-0 group-hover:bg-white dark:group-hover:bg-gray-600 group-hover:text-primary transition-colors"><i data-lucide="file-text" class="w-5 h-5"></i></div>
            <div><span class="block font-semibold text-gray-800 dark:text-gray-200">${post.title}</span><span class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">${post.summary}</span></div>
            <i data-lucide="arrow-right" class="ml-auto w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary"></i>
        `;
        container.appendChild(btn);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showProntuarioSection(id, specialty) {
    const data = contentCache[id] || { title: 'Seção', content: '<p class="text-gray-400 italic">Em desenvolvimento.</p>' };
    
    document.getElementById(`prontuario-menu-${specialty}`).classList.add('hidden');
    document.getElementById(`dynamic-content-area-${specialty}`).classList.remove('hidden');
    
    document.getElementById(`dynamic-title-${specialty}`).textContent = data.title;
    document.getElementById(`dynamic-body-${specialty}`).innerHTML = data.content;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideProntuarioSections(specialty) {
    document.getElementById(`dynamic-content-area-${specialty}`).classList.add('hidden');
    document.getElementById(`prontuario-menu-${specialty}`).classList.remove('hidden');
}

function openFixedContent(id, title, defaultContent) {
    const data = contentCache[id] || { id: id, title: title, category: 'Geral', content: defaultContent || '<p>Conteúdo em breve.</p>' };
    openPost(null, data); 
}

function openPost(id, dataObj = null, returnViewId = null) {
    const post = dataObj || contentCache[id];
    if (!post) return;

    document.getElementById('post-category').textContent = post.category;
    document.getElementById('post-title').textContent = post.title;
    document.getElementById('post-content').innerHTML = post.content;
    
    const btnEdit = document.getElementById('btn-edit-post');
    
    if (isAdmin && post.summary) {
        btnEdit.onclick = () => openEditor(post.id, post.title, post.category, post.summary);
        btnEdit.classList.remove('hidden');
    } else {
        btnEdit.classList.add('hidden');
    }

    if (returnViewId) {
        window.postBackTarget = returnViewId;
    } else {
        window.postBackTarget = (post.id === 'links-uteis') ? 'home' : 'blog';
    }

    navigateTo('post');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- FUNÇÕES DE NAVEGAÇÃO E EDITOR ---
function openEditor(id = null, title = '', category = '', summary = '') {
    if(id && contentCache[id]) {
        const data = contentCache[id];
        title = data.title;
        category = data.category;
        summary = data.summary;
        document.getElementById('editor-content').innerHTML = data.content;
        document.getElementById('btn-delete').classList.remove('hidden');
    } else {
        document.getElementById('editor-content').innerHTML = '';
        document.getElementById('btn-delete').classList.add('hidden');
    }

    document.getElementById('edit-id').value = id || '';
    document.getElementById('edit-title').value = title;
    document.getElementById('edit-category').value = category;
    document.getElementById('edit-summary').value = summary || '';
    
    navigateTo('editor');
}

async function saveProtocol(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const spinner = document.getElementById('save-spinner');
    btn.disabled = true; spinner.classList.remove('hidden');

    let id = document.getElementById('edit-id').value;
    const data = {
        title: document.getElementById('edit-title').value,
        category: document.getElementById('edit-category').value,
        summary: document.getElementById('edit-summary').value,
        content: document.getElementById('editor-content').innerHTML,
        updatedAt: new Date()
    };

    try {
        if (isFirebaseActive) {
            if (id) {
                await db.collection('protocols').doc(id).set(data, { merge: true });
            } else {
                const docRef = await db.collection('protocols').add(data);
                id = docRef.id;
            }
        } else {
            if(!id) id = Date.now().toString();
            contentCache[id] = { id, ...data };
            const cacheArray = Object.values(contentCache);
            localStorage.setItem('gc_protocols', JSON.stringify(cacheArray));
        }
        
        contentCache[id] = { id, ...data };
        navigateTo('blog');

    } catch (err) { console.error(err); alert("Erro ao salvar."); } 
    finally { btn.disabled = false; spinner.classList.add('hidden'); }
}

async function deleteProtocol() {
    if(!confirm("Excluir?")) return;
    const id = document.getElementById('edit-id').value;
    if(isFirebaseActive) await db.collection('protocols').doc(id).delete();
    delete contentCache[id];
    
        if (!isFirebaseActive) {
        const cacheArray = Object.values(contentCache);
        localStorage.setItem('gc_protocols', JSON.stringify(cacheArray));
        }

    navigateTo('blog');
}

function navigateTo(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    window.scrollTo(0, 0);
    
    const backBtn = document.getElementById('back-btn');
    
    if (viewId === 'home') {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
        if (viewId === 'post') {
            backBtn.onclick = () => navigateTo(window.postBackTarget || 'blog');
        } else if (viewId === 'editor') {
            backBtn.onclick = () => navigateTo('blog');
        } else {
            backBtn.onclick = () => navigateTo('home');
        }
    }
    
    updateUI();
}

function switchTab(tabName, specialty) {
    const container = document.getElementById(`view-${specialty}`);
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove(`tab-active-${specialty}`);
    });

    const clickedBtn = document.getElementById(`tab-btn-${specialty}-${tabName}`);
    if(clickedBtn) {
        clickedBtn.classList.add('active');
        clickedBtn.classList.add(`tab-active-${specialty}`);
    }

    container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${specialty}-${tabName}`).classList.add('active');

    if(tabName === 'protocolos') {
        renderSpecialtyProtocols(specialty);
    }
}

function toggleFullScreen() {
    const elem = document.getElementById('pdf-container');
    if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => {
            alert(`Error: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// Inicializa
loadSiteContent();
