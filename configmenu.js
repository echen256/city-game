export class ConfigMenu {
  constructor(settings, onSettingsChange) {
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.isVisible = false;
    this.menuElement = null;
    this.originalSettings = JSON.parse(JSON.stringify(settings));
    
    this.createMenuHTML();
    this.bindEvents();
  }

  createMenuHTML() {
    this.menuElement = document.createElement('div');
    this.menuElement.id = 'config-menu';
    this.menuElement.className = 'config-menu hidden';
    
    const menuHTML = `
      <div class="config-menu-content">
        <div class="config-menu-header">
          <h2>Game Settings</h2>
          <button class="close-btn" id="close-config">×</button>
        </div>
        <div class="config-menu-body">
          ${this.generateSettingsHTML(this.settings)}
        </div>
        <div class="config-menu-footer">
          <button class="btn btn-primary" id="apply-settings">Apply</button>
          <button class="btn btn-secondary" id="reset-settings">Reset</button>
          <button class="btn btn-secondary" id="cancel-settings">Cancel</button>
        </div>
      </div>
    `;
    
    this.menuElement.innerHTML = menuHTML;
    document.body.appendChild(this.menuElement);
    
    this.addStyles();
  }

  generateSettingsHTML(obj, path = '') {
    let html = '';
    
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        html += `
          <div class="config-section">
            <h3>${this.formatLabel(key)}</h3>
            <div class="config-subsection">
              ${this.generateSettingsHTML(value, fullPath)}
            </div>
          </div>
        `;
      } else {
        html += this.generateInputHTML(key, value, fullPath);
      }
    }
    
    return html;
  }

  generateInputHTML(key, value, path) {
    const label = this.formatLabel(key);
    const inputId = `config-${path.replace(/\./g, '-')}`;
    
    if (typeof value === 'boolean') {
      return `
        <div class="config-item">
          <label for="${inputId}">${label}</label>
          <input type="checkbox" id="${inputId}" data-path="${path}" ${value ? 'checked' : ''}>
        </div>
      `;
    } else if (typeof value === 'number') {
      const step = value % 1 === 0 ? '1' : '0.01';
      const min = this.getMinValue(key, value);
      const max = this.getMaxValue(key, value);
      
      return `
        <div class="config-item">
          <label for="${inputId}">${label}</label>
          <div class="number-input">
            <input type="number" id="${inputId}" data-path="${path}" value="${value}" 
                   step="${step}" min="${min}" max="${max}">
            <input type="range" id="${inputId}-range" data-path="${path}" value="${value}" 
                   step="${step}" min="${min}" max="${max}">
          </div>
        </div>
      `;
    } else if (typeof value === 'string' && value.startsWith('0x')) {
      const hexValue = value.replace('0x', '#');
      return `
        <div class="config-item">
          <label for="${inputId}">${label}</label>
          <input type="color" id="${inputId}" data-path="${path}" value="${hexValue}">
        </div>
      `;
    } else {
      return `
        <div class="config-item">
          <label for="${inputId}">${label}</label>
          <input type="text" id="${inputId}" data-path="${path}" value="${value}">
        </div>
      `;
    }
  }

  formatLabel(key) {
    return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  getMinValue(key, currentValue) {
    const minRules = {
      'gridSize': 10,
      'minHeight': -50,
      'maxHeight': -10,
      'smoothness': 0,
      'minHills': 1,
      'maxHills': 1,
      'hillRadius': 1,
      'hillIntensity': 0,
      'speed': 0.01,
      'avatarRadius': 0.1,
      'shimmerSpeed': 0.0001,
      'shimmerIntensity': 0
    };
    
    return minRules[key] !== undefined ? minRules[key] : Math.min(0, currentValue - Math.abs(currentValue));
  }

  getMaxValue(key, currentValue) {
    const maxRules = {
      'gridSize': 200,
      'minHeight': 10,
      'maxHeight': 50,
      'smoothness': 2,
      'minHills': 10,
      'maxHills': 10,
      'hillRadius': 50,
      'hillIntensity': 20,
      'speed': 2,
      'avatarRadius': 2,
      'shimmerSpeed': 0.01,
      'shimmerIntensity': 1
    };
    
    return maxRules[key] !== undefined ? maxRules[key] : Math.max(100, currentValue + Math.abs(currentValue));
  }

  addStyles() {
    if (document.getElementById('config-menu-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'config-menu-styles';
    style.textContent = `
      .config-menu {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
      }
      
      .config-menu.hidden {
        display: none;
      }
      
      .config-menu-content {
        background: #2a2a2a;
        color: white;
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 80%;
        display: flex;
        flex-direction: column;
      }
      
      .config-menu-header {
        padding: 20px;
        border-bottom: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .config-menu-header h2 {
        margin: 0;
        color: white;
      }
      
      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
      }
      
      .config-menu-body {
        padding: 20px;
        overflow-y: auto;
        flex-grow: 1;
      }
      
      .config-section {
        margin-bottom: 20px;
      }
      
      .config-section h3 {
        color: #ccc;
        margin-bottom: 10px;
        text-transform: uppercase;
        font-size: 14px;
        letter-spacing: 1px;
      }
      
      .config-subsection {
        margin-left: 15px;
        border-left: 2px solid #444;
        padding-left: 15px;
      }
      
      .config-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 8px 0;
      }
      
      .config-item label {
        flex: 1;
        margin-right: 15px;
        color: #ddd;
      }
      
      .config-item input[type="checkbox"] {
        width: 20px;
        height: 20px;
      }
      
      .config-item input[type="text"], 
      .config-item input[type="number"] {
        background: #444;
        border: 1px solid #666;
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        width: 100px;
      }
      
      .config-item input[type="color"] {
        width: 50px;
        height: 30px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .number-input {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .number-input input[type="range"] {
        width: 100px;
      }
      
      .config-menu-footer {
        padding: 20px;
        border-top: 1px solid #444;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .btn-primary {
        background: #0066cc;
        color: white;
      }
      
      .btn-secondary {
        background: #666;
        color: white;
      }
      
      .btn:hover {
        opacity: 0.8;
      }
    `;
    
    document.head.appendChild(style);
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  show() {
    this.isVisible = true;
    this.menuElement.classList.remove('hidden');
    this.bindMenuEvents();
  }

  hide() {
    this.isVisible = false;
    this.menuElement.classList.add('hidden');
  }

  bindMenuEvents() {
    const closeBtn = this.menuElement.querySelector('#close-config');
    const applyBtn = this.menuElement.querySelector('#apply-settings');
    const resetBtn = this.menuElement.querySelector('#reset-settings');
    const cancelBtn = this.menuElement.querySelector('#cancel-settings');

    closeBtn.onclick = () => this.hide();
    cancelBtn.onclick = () => this.hide();
    applyBtn.onclick = () => this.applySettings();
    resetBtn.onclick = () => this.resetSettings();

    // Bind input events for live preview
    const inputs = this.menuElement.querySelectorAll('input[data-path]');
    inputs.forEach(input => {
      const syncInputs = (value) => {
        const path = input.dataset.path;
        const rangeInput = this.menuElement.querySelector(`#${input.id}-range`);
        const numberInput = this.menuElement.querySelector(`#${input.id}:not([type="range"])`);
        
        if (rangeInput && input.type === 'number') {
          rangeInput.value = value;
        } else if (numberInput && input.type === 'range') {
          numberInput.value = value;
        }
      };

      input.addEventListener('input', (e) => {
        syncInputs(e.target.value);
        this.previewSetting(input.dataset.path, this.getInputValue(input));
      });
    });
  }

  getInputValue(input) {
    if (input.type === 'checkbox') {
      return input.checked;
    } else if (input.type === 'number' || input.type === 'range') {
      return parseFloat(input.value);
    } else if (input.type === 'color') {
      return '0x' + input.value.substring(1);
    } else {
      return input.value;
    }
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  previewSetting(path, value) {
    const tempSettings = JSON.parse(JSON.stringify(this.settings));
    this.setNestedValue(tempSettings, path, value);
    
    if (this.onSettingsChange) {
      this.onSettingsChange(tempSettings, true); // true indicates preview mode
    }
  }

  applySettings() {
    const inputs = this.menuElement.querySelectorAll('input[data-path]');
    const newSettings = JSON.parse(JSON.stringify(this.settings));
    
    inputs.forEach(input => {
      const value = this.getInputValue(input);
      this.setNestedValue(newSettings, input.dataset.path, value);
    });
    
    this.settings = newSettings;
    
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings, false); // false indicates final apply
    }
    
    this.hide();
  }

  resetSettings() {
    this.settings = JSON.parse(JSON.stringify(this.originalSettings));
    
    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings, false);
    }
    
    // Update UI
    this.menuElement.remove();
    this.createMenuHTML();
    this.show();
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}