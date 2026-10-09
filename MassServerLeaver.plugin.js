/**
 * @name MassServerLeaver
 * @version 1.1.0
 * @description Advanced tool to bulk leave the servers you don't want. Just by holding ctrl and clicking on the servers you want to select them.
 * @author Sonny
 */

module.exports = class MassServerLeaver {
    constructor(meta) {
        this.meta = meta;
        this.selectedGuildIds = new Set();
        this.isProcessing = false;
        this.shouldCancel = false;
        this.mfaCode = null;
        this.logs = [];
        this.handleClickListener = this.handleClickListener.bind(this);
        this.handleKeyListener = this.handleKeyListener.bind(this);
        this.handleMutation = this.handleMutation.bind(this);
        this.observer = new MutationObserver(this.handleMutation);
    }

    start() {
        this.injectStyles();
        document.addEventListener("click", this.handleClickListener, true);
        document.addEventListener("keydown", this.handleKeyListener, true);
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.renderSelectionBar();
        this.log("System", "MassServerLeaver v9.0.0 initialized successfully. Press Shift + [ or click 'Logs' button.");
    }

    stop() {
        document.removeEventListener("click", this.handleClickListener, true);
        document.removeEventListener("keydown", this.handleKeyListener, true);
        this.observer.disconnect();
        this.clearSelection();
        this.removeSelectionBar();
        this.removeLogModal();
        this.removeStyles();
    }

    log(type, message, details = null) {
        const time = new Date().toLocaleTimeString();
        const entry = { time, type, message, details };
        this.logs.unshift(entry);
        console.log(`[MassServerLeaver][${type}] ${message}`, details || "");

        const logContainer = document.querySelector("#msl-log-container");
        if (logContainer) {
            const item = document.createElement("div");
            item.className = "msl-log-entry";
            item.innerHTML = `
                <span class="msl-log-time">[${time}]</span>
                <span class="msl-log-type msl-type-${type.toLowerCase()}">${type}:</span>
                <span class="msl-log-msg">${BdApi.DOM.escapeHTML(message)}</span>
                ${details ? `<pre class="msl-log-details">${BdApi.DOM.escapeHTML(JSON.stringify(details, null, 2))}</pre>` : ""}
            `;
            logContainer.prepend(item);
        }
    }

    injectStyles() {
        BdApi.DOM.addStyle("msl-ctrl-styles", `
            [data-list-item-id^="guildsnav___"].msl-selected-guild [class*="wrapper"] {
                box-shadow: 0 0 0 3px #da373c !important;
                border-radius: 16px !important;
                transition: box-shadow 0.15s ease;
            }
            [data-list-item-id^="guildsnav___"].msl-selected-guild {
                position: relative !important;
            }
            [data-list-item-id^="guildsnav___"].msl-selected-guild::after {
                content: "✓" !important;
                position: absolute !important;
                top: 0px !important;
                right: 0px !important;
                background: #da373c !important;
                color: #ffffff !important;
                font-size: 11px !important;
                font-weight: 900 !important;
                width: 18px !important;
                height: 18px !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 99999 !important;
                pointer-events: none !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
            }
            .msl-floating-bar {
                position: fixed;
                bottom: 24px;
                left: 84px;
                background: var(--bg-surface-overlay, var(--background-floating, #111214));
                border: 1px solid var(--border-subtle, #2b2d31);
                border-radius: 8px;
                padding: 10px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 99999;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                color: var(--header-primary, #fff);
                font-family: var(--font-primary, sans-serif);
                animation: msl-slide-in 0.2s ease;
            }
            @keyframes msl-slide-in {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .msl-btn-danger {
                background: #da373c; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 13px;
            }
            .msl-btn-danger:hover { background: #a1282c; }
            .msl-btn-secondary {
                background: #4e5058; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 500; cursor: pointer; font-size: 13px;
            }
            .msl-btn-secondary:hover { background: #6d6f78; }
            .msl-modal-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 999999;
                font-family: var(--font-primary, sans-serif);
            }
            .msl-modal {
                background: var(--bg-surface-overlay, var(--background-primary, #313338));
                width: 580px; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5); color: var(--header-primary, #fff);
            }
            .msl-modal h3 { margin: 0; font-size: 18px; font-weight: 600; }
            .msl-input {
                background: var(--background-tertiary, #1e1f22); border: 1px solid var(--background-modifier-accent, #3f4147);
                border-radius: 4px; padding: 8px 12px; color: #fff; outline: none; font-size: 14px;
            }
            .msl-log-container {
                background: var(--background-tertiary, #1e1f22); border-radius: 6px; padding: 10px; height: 320px;
                overflow-y: auto; font-family: monospace; font-size: 12px; display: flex; flex-direction: column; gap: 6px;
            }
            .msl-log-entry { border-bottom: 1px solid var(--background-modifier-accent, #2b2d31); padding-bottom: 4px; }
            .msl-log-time { color: #80848e; margin-right: 6px; }
            .msl-log-type { font-weight: bold; margin-right: 6px; }
            .msl-type-error { color: #f23f43; }
            .msl-type-info { color: #5865f2; }
            .msl-type-success { color: #23a55a; }
            .msl-type-system { color: #f0b232; }
            .msl-log-details { background: rgba(0,0,0,0.3); padding: 4px; border-radius: 4px; margin: 4px 0 0 0; white-space: pre-wrap; word-break: break-all; }
        `);
    }

    removeStyles() {
        BdApi.DOM.removeStyle("msl-ctrl-styles");
    }

    getDiscordModules() {
        const GuildStore = BdApi.Webpack.getStore("GuildStore") || BdApi.Webpack.getModule(m => m?.getGuilds && m?.getGuild);
        const UserStore = BdApi.Webpack.getStore("UserStore") || BdApi.Webpack.getModule(m => m?.getCurrentUser);
        const TokenModule = BdApi.Webpack.getByKeys("getToken") || BdApi.Webpack.getModule(m => m?.getToken);
        const HTTP = BdApi.Webpack.getByKeys("del", "get", "post") || BdApi.Webpack.getModule(m => m?.del && m?.get && m?.post);
        const Dispatcher = BdApi.Webpack.getByKeys("dispatch", "subscribe") || BdApi.Webpack.getModule(m => m?.dispatch && m?.subscribe);
        
        const GuildActions = BdApi.Webpack.getByKeys("leaveGuild", "deleteGuild") || 
                             BdApi.Webpack.getModule(m => typeof m?.leaveGuild === "function") ||
                             BdApi.Webpack.getModule(m => m?.default?.leaveGuild, { searchExports: true });

        return { GuildStore, UserStore, TokenModule, HTTP, Dispatcher, GuildActions };
    }

    getSuperProperties() {
        try {
            const payload = {
                os: "Windows",
                browser: "Discord Client",
                release_channel: "stable",
                client_version: "1.0.9000",
                os_version: "10.0.19045",
                system_locale: "en-US",
                client_build_number: 280000,
                native_build_number: 40000
            };
            return btoa(JSON.stringify(payload));
        } catch (e) {
            return "";
        }
    }

    handleKeyListener(event) {
        if (event.shiftKey && (event.key === "{" || event.key === "[" || event.code === "BracketLeft")) {
            event.preventDefault();
            this.toggleLogModal();
        }
    }

    handleMutation() {
        if (this.selectedGuildIds.size === 0) return;
        this.selectedGuildIds.forEach(guildId => {
            const navItem = document.querySelector(`[data-list-item-id="guildsnav___${guildId}"]`);
            if (navItem && !navItem.classList.contains("msl-selected-guild")) {
                navItem.classList.add("msl-selected-guild");
            }
        });
    }

    handleClickListener(event) {
        if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return;

        const navItem = event.target.closest('[data-list-item-id^="guildsnav___"]');
        if (!navItem) return;

        const itemId = navItem.getAttribute("data-list-item-id");
        if (!itemId || itemId.includes("home") || itemId.includes("create") || itemId.includes("explore")) return;

        const guildId = itemId.replace("guildsnav___", "");
        if (!guildId) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        this.toggleGuildSelection(guildId, navItem);
    }

    toggleGuildSelection(guildId, navItem) {
        if (this.selectedGuildIds.has(guildId)) {
            this.selectedGuildIds.delete(guildId);
            navItem.classList.remove("msl-selected-guild");
            this.log("Info", `Deselected guild ${guildId}`);
        } else {
            this.selectedGuildIds.add(guildId);
            navItem.classList.add("msl-selected-guild");
            this.log("Info", `Selected guild ${guildId}`);
        }

        this.updateSelectionBar();
    }

    clearSelection() {
        this.selectedGuildIds.clear();
        document.querySelectorAll(".msl-selected-guild").forEach(el => {
            el.classList.remove("msl-selected-guild");
        });
        this.updateSelectionBar();
        this.log("Info", "Cleared all selected guilds.");
    }

    renderSelectionBar() {
        if (document.querySelector(".msl-floating-bar")) return;

        const bar = document.createElement("div");
        bar.className = "msl-floating-bar";
        bar.style.display = "none";
        bar.innerHTML = `
            <span id="msl-counter" style="font-size: 14px; font-weight: 600;">0 servers selected</span>
            <button class="msl-btn-danger" id="msl-leave-btn">Process Selected</button>
            <button class="msl-btn-secondary" id="msl-clear-btn">Clear</button>
            <button class="msl-btn-secondary" id="msl-logs-btn">Logs (Shift+[)</button>
            <button class="msl-btn-secondary" id="msl-stop-btn" style="display:none; background: #e5a93c; color: #000;">Stop</button>
        `;

        document.body.appendChild(bar);

        bar.querySelector("#msl-clear-btn").onclick = () => this.clearSelection();
        bar.querySelector("#msl-logs-btn").onclick = () => this.toggleLogModal();
        bar.querySelector("#msl-leave-btn").onclick = () => this.processSelectedGuilds();
        bar.querySelector("#msl-stop-btn").onclick = () => {
            this.shouldCancel = true;
            this.log("System", "Cancellation requested by user.");
            BdApi.UI.showToast("Stopping operations...", { type: "info" });
        };
    }

    removeSelectionBar() {
        const bar = document.querySelector(".msl-floating-bar");
        if (bar) bar.remove();
    }

    updateSelectionBar() {
        const bar = document.querySelector(".msl-floating-bar");
        if (!bar) return;

        const count = this.selectedGuildIds.size;
        if (count > 0 || this.isProcessing) {
            bar.style.display = "flex";
            if (!this.isProcessing) {
                bar.querySelector("#msl-counter").innerText = `${count} server${count > 1 ? "s" : ""} selected`;
            }
        } else {
            bar.style.display = "none";
        }
    }

    toggleLogModal() {
        if (document.querySelector(".msl-log-overlay")) {
            this.removeLogModal();
        } else {
            this.renderLogModal();
        }
    }

    renderLogModal() {
        if (document.querySelector(".msl-log-overlay")) return;

        const overlay = document.createElement("div");
        overlay.className = "msl-modal-overlay msl-log-overlay";
        overlay.innerHTML = `
            <div class="msl-modal" style="width: 640px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>Mass Server Leaver - Log Manager</h3>
                    <span style="font-size: 12px; color: #80848e;">Shortcut: Shift + [</span>
                </div>
                <div class="msl-log-container" id="msl-log-container"></div>
                <div style="display: flex; justify-content: space-between;">
                    <button class="msl-btn-secondary" id="msl-clear-logs">Clear Logs</button>
                    <button class="msl-btn-secondary" id="msl-close-logs">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector("#msl-close-logs").onclick = () => this.removeLogModal();
        overlay.querySelector("#msl-clear-logs").onclick = () => {
            this.logs = [];
            document.querySelector("#msl-log-container").innerHTML = "";
        };

        const logContainer = overlay.querySelector("#msl-log-container");
        this.logs.forEach(entry => {
            const item = document.createElement("div");
            item.className = "msl-log-entry";
            item.innerHTML = `
                <span class="msl-log-time">[${entry.time}]</span>
                <span class="msl-log-type msl-type-${entry.type.toLowerCase()}">${entry.type}:</span>
                <span class="msl-log-msg">${BdApi.DOM.escapeHTML(entry.message)}</span>
                ${entry.details ? `<pre class="msl-log-details">${BdApi.DOM.escapeHTML(JSON.stringify(entry.details, null, 2))}</pre>` : ""}
            `;
            logContainer.appendChild(item);
        });
    }

    removeLogModal() {
        const overlay = document.querySelector(".msl-log-overlay");
        if (overlay) overlay.remove();
    }

    showOwnerModal(guildName) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "msl-modal-overlay";
            overlay.innerHTML = `
                <div class="msl-modal">
                    <h3>Server Ownership Detected</h3>
                    <p>You own <strong>${BdApi.DOM.escapeHTML(guildName)}</strong>. Delete this server permanently?</p>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
                        <button class="msl-btn-secondary" id="msl-skip-owner">Skip</button>
                        <button class="msl-btn-danger" id="msl-delete-owner">Delete Server</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.querySelector("#msl-delete-owner").onclick = () => {
                overlay.remove();
                resolve(true);
            };

            overlay.querySelector("#msl-skip-owner").onclick = () => {
                overlay.remove();
                resolve(false);
            };
        });
    }

    promptMfaCode() {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "msl-modal-overlay";
            overlay.innerHTML = `
                <div class="msl-modal">
                    <h3>2FA Verification Required</h3>
                    <p>Enter your 6-digit Authenticator / Backup code to authorize server deletion:</p>
                    <input type="text" class="msl-input" id="msl-mfa-input" placeholder="e.g. 123456" maxlength="8" />
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
                        <button class="msl-btn-secondary" id="msl-cancel-mfa">Cancel</button>
                        <button class="msl-btn-danger" id="msl-confirm-mfa">Submit</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            const input = overlay.querySelector("#msl-mfa-input");
            input.focus();

            const submit = () => {
                const val = input.value.trim();
                overlay.remove();
                resolve(val || null);
            };

            overlay.querySelector("#msl-confirm-mfa").onclick = submit;
            input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
            overlay.querySelector("#msl-cancel-mfa").onclick = () => {
                overlay.remove();
                resolve(null);
            };
        });
    }

    async leaveGuildRequest(guildId, modules) {
        const { GuildActions, TokenModule, Dispatcher } = modules;
        this.log("Info", `Attempting leave operation for guild: ${guildId}`);

        // Method 1: Webpack Flux Action
        const leaveFn = GuildActions?.leaveGuild || GuildActions?.default?.leaveGuild;
        if (typeof leaveFn === "function") {
            try {
                await leaveFn(guildId);
                this.log("Success", `Left guild ${guildId} via Webpack GuildActions`);
                return true;
            } catch (err) {
                this.log("Error", `GuildActions leave failed for ${guildId}, attempting REST endpoint...`, err);
            }
        }

        // Method 2: Authenticated REST DELETE Call
        const token = TokenModule?.getToken();
        if (token) {
            const res = await fetch(`https://discord.com/api/v9/users/@me/guilds/${guildId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json",
                    "X-Super-Properties": this.getSuperProperties()
                },
                body: JSON.stringify({ quitting: true })
            });

            if (res.ok || res.status === 204) {
                this.log("Success", `Left guild ${guildId} via REST endpoint [Status ${res.status}]`);
                if (Dispatcher && typeof Dispatcher.dispatch === "function") {
                    Dispatcher.dispatch({ type: "GUILD_DELETE", guild: { id: guildId } });
                }
                return true;
            } else {
                const data = await res.json().catch(() => ({}));
                this.log("Error", `REST API leave failed for ${guildId} [Status ${res.status}]`, data);
                throw new Error(`HTTP ${res.status}: ${data.message || "Failed to leave guild"}`);
            }
        }

        throw new Error("Failed to find valid Discord token or Webpack leave action.");
    }

    async deleteGuildRequest(guildId, modules, code = null) {
        const { GuildActions, TokenModule, Dispatcher } = modules;
        this.log("Info", `Attempting deletion for guild: ${guildId} (Code: ${code || "None"})`);

        const deleteFn = GuildActions?.deleteGuild || GuildActions?.default?.deleteGuild;
        if (typeof deleteFn === "function") {
            try {
                await deleteFn(guildId, code);
                this.log("Success", `Deleted guild ${guildId} via Webpack GuildActions`);
                return true;
            } catch (err) {
                this.log("Error", `GuildActions delete failed, falling back to REST endpoint...`, err);
            }
        }

        const token = TokenModule?.getToken();
        if (token) {
            const headers = {
                "Authorization": token,
                "Content-Type": "application/json",
                "X-Super-Properties": this.getSuperProperties()
            };
            if (code) headers["X-Discord-MFA-Authorization"] = code;

            const res = await fetch(`https://discord.com/api/v9/guilds/${guildId}/delete`, {
                method: "POST",
                headers,
                body: JSON.stringify(code ? { code } : {})
            });

            if (res.ok || res.status === 204) {
                this.log("Success", `Deleted guild ${guildId} via REST endpoint [Status ${res.status}]`);
                if (Dispatcher && typeof Dispatcher.dispatch === "function") {
                    Dispatcher.dispatch({ type: "GUILD_DELETE", guild: { id: guildId } });
                }
                return true;
            } else {
                const data = await res.json().catch(() => ({}));
                this.log("Error", `REST API delete failed for ${guildId} [Status ${res.status}]`, data);
                if (res.status === 400 || res.status === 401 || res.status === 403 || data.code === 60001) {
                    throw new Error("MFA_REQUIRED");
                }
                throw new Error(`HTTP ${res.status}: ${data.message || "Failed to delete guild"}`);
            }
        }

        throw new Error("Failed to find valid Discord token or Webpack delete action.");
    }

    async processSelectedGuilds() {
        if (this.isProcessing || this.selectedGuildIds.size === 0) return;

        const modules = this.getDiscordModules();
        this.log("System", "Starting bulk processing...", { selectedCount: this.selectedGuildIds.size });

        const currentUser = modules.UserStore?.getCurrentUser();
        const idsToProcess = Array.from(this.selectedGuildIds);

        this.isProcessing = true;
        this.shouldCancel = false;

        const leaveBtn = document.querySelector("#msl-leave-btn");
        const clearBtn = document.querySelector("#msl-clear-btn");
        const stopBtn = document.querySelector("#msl-stop-btn");

        if (leaveBtn) leaveBtn.style.display = "none";
        if (clearBtn) clearBtn.style.display = "none";
        if (stopBtn) stopBtn.style.display = "inline-block";

        let successCount = 0;
        const total = idsToProcess.length;

        for (let i = 0; i < idsToProcess.length; i++) {
            if (this.shouldCancel) {
                this.log("System", "Operation batch cancelled by user.");
                break;
            }

            const guildId = idsToProcess[i];
            const guild = modules.GuildStore?.getGuild(guildId);
            const name = guild ? guild.name : guildId;
            const isOwner = guild && currentUser && guild.ownerId === currentUser.id;

            const counter = document.querySelector("#msl-counter");
            if (counter) counter.innerText = `[${i + 1}/${total}] Processing: ${name}`;

            try {
                if (isOwner) {
                    this.log("Info", `Guild ${name} (${guildId}) is owned by current user.`);
                    const confirmDelete = await this.showOwnerModal(name);
                    if (confirmDelete) {
                        try {
                            await this.deleteGuildRequest(guildId, modules, this.mfaCode);
                            successCount++;
                        } catch (deleteErr) {
                            if (deleteErr.message === "MFA_REQUIRED") {
                                this.log("Info", "2FA authentication code requested from user.");
                                const userCode = await this.promptMfaCode();
                                if (userCode) {
                                    this.mfaCode = userCode;
                                    await this.deleteGuildRequest(guildId, modules, userCode);
                                    successCount++;
                                } else {
                                    this.log("System", `Skipped ${name}: No 2FA code provided.`);
                                    BdApi.UI.showToast(`Skipped ${name}: 2FA code was not provided.`, { type: "warning" });
                                }
                            } else {
                                throw deleteErr;
                            }
                        }
                    } else {
                        this.log("Info", `Skipped owned server: ${name}`);
                        BdApi.UI.showToast(`Skipped owned server: ${name}`, { type: "info" });
                    }
                } else {
                    await this.leaveGuildRequest(guildId, modules);
                    successCount++;
                }

                const navItem = document.querySelector(`[data-list-item-id="guildsnav___${guildId}"]`);
                if (navItem) navItem.classList.remove("msl-selected-guild");
                this.selectedGuildIds.delete(guildId);

            } catch (err) {
                this.log("Error", `Failed processing for ${name} (${guildId})`, { error: err.message });
                BdApi.UI.showToast(`Failed operation for: ${name}. Check logs (Shift+[)`, { type: "error" });
            }

            await new Promise(res => setTimeout(res, 1500));
        }

        this.isProcessing = false;

        if (leaveBtn) leaveBtn.style.display = "inline-block";
        if (clearBtn) clearBtn.style.display = "inline-block";
        if (stopBtn) stopBtn.style.display = "none";

        this.updateSelectionBar();
        this.log("System", `Batch finished. Successfully processed ${successCount} of ${total} server(s).`);
        BdApi.UI.showToast(`Batch finished. Processed ${successCount} server(s).`, { type: "success" });
    }
};