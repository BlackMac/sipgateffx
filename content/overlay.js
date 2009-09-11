/*****************************************************************************

    sipgate FFX - Firefox Extension for Mozilla Firefox Webbrowser
    Copyright (C) 2009 sipgate GmbH, Germany

    The original code is hosted at 
    http://www.github.com/sipgate/sipgateffx

    sipgateFFX is free software; you can redistribute it and/or modify
    it under the terms of version 2 of the GNU General Public License
    as published by the Free Software Foundation.

    sipgateFFX is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
    02110-1301, USA

*****************************************************************************/

var debug = true;
var sgffx;
var sgffxDB;

var url = {
    "history": "/#filter_inbox",
    "historycall": "/#type_call",
    "historyfax": "/#type_fax",
    "historysms": "/#type_sms",
    "credit": "/settings/account/creditaccount",
    "voicemail": "/#type_voicemail",
    "fax": "/fax",
    "phonebook": "/contacts",
    "itemized": "/settings/account/evn",
    "default": "/user/index.php"
};
var sipgateffx_this;

var sipgateffx = {
	onLoad: function(event) {
		// initialization code
		this.initialized = true;
		this.strings = document.getElementById("sipgateffx-strings");
		sipgateffx_this = this;
		
		try {
			// this is needed to generally allow usage of components in javascript
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

			sgffx = Components.classes['@api.sipgate.net/sipgateffx;1']
											.getService().wrappedJSObject;
											
			try {
				sgffxDB = Components.classes['@api.sipgate.net/sipgateffx-storage;1']
												.getService().wrappedJSObject;
			} catch(e) {
				dump("ERROR while initializing DB: " + e);
			}
			
		} catch (anError) {
			dump("ERROR: " + anError);
			return;
		}
		
		sgffxDB.getBlacklistedSites();
		
		// set language:
		try { 
			if (navigator.language.match(/de/) == "de") {
				sgffx.language = "de";
			} else {
				sgffx.language = "en"; 
			}
		} catch (lang_ex) {
			sgffx.log("Error in detecting language! Found: "+navigator.language.match(/de/)+". Falling back to 'en' ...\n");
			sgffx.language = "en"; 
		}
		
		sgffx.strings = this.strings;
		
		var allElements = [
			'sipgateContacts',
			'showcreditmenuitem',
			'pollbalance',
			'showvoicemailmenuitem',
			'showphonebookmenuitem',
			'showsmsformmenuitem',
			'showphonenumberformmenuitem',
			'showhistorymenuitem',
			'showfaxmenuitem',
			'showitemizedmenuitem',
			'dialactivate',
			'item_logoff',
			'separator1',
			'separator2',
			'dialdeactivate',
			'item_logon',

			'sipgateffx_loggedout',
			'sipgateffx_loggedin',

			'BalanceText',

			'sipgateffx_c2dStatus',
			'sipgateffx_c2dStatusText',			
			'sipgatecmd_c2dCancellCall',
			
			'sipgatenotificationPanel',
			
			'sipgateffxDND',
			'sipgateffxDNDon',
			'sipgateffxDNDoff',
			
			'sipgateffxEventsCall',
			'sipgateffxEventsFax',
			'sipgateffxEventsSMS'
		];

		for(var i = 0; i < allElements.length; i++)
		{
			sgffx.setXulObjectReference(allElements[i], document.getElementById(allElements[i]));
		}

		sgffx.setXulObjectVisibility('showcreditmenuitem', 0);
		sgffx.setXulObjectVisibility('pollbalance', 0);
		sgffx.setXulObjectVisibility('showvoicemailmenuitem', 0);
		sgffx.setXulObjectVisibility('showphonebookmenuitem', 0);
		sgffx.setXulObjectVisibility('showsmsformmenuitem', 0);
		sgffx.setXulObjectVisibility('showphonenumberformmenuitem', 0);
		sgffx.setXulObjectVisibility('showhistorymenuitem', 0);
		sgffx.setXulObjectVisibility('showfaxmenuitem', 0);
		sgffx.setXulObjectVisibility('showitemizedmenuitem', 0);
		sgffx.setXulObjectVisibility('item_logoff', 0);
		sgffx.setXulObjectVisibility('separator1', 0);
		sgffx.setXulObjectVisibility('separator2', 1);
		
		sgffx.setXulObjectVisibility('dialdeactivate', 0);
		sgffx.setXulObjectVisibility('dialactivate', 0);
		
		// sgffx.setXulObjectVisibility('sipgate-c2d-status-bar', 1);
		
		var contextMenuHolder = "contentAreaContextMenu";
		if(app=='thunderbird') {
			contextMenuHolder = "mailContext";
		}

		document.getElementById(contextMenuHolder)
			.addEventListener("popupshowing", function(e) { sipgateffx_this.showContextMenu(e); }, false);
		
		document.getElementById('sipgateLogo').addEventListener("click", function(e) {
			// more Info: https://developer.mozilla.org/en/XUL%3aMethod%3aopenPopup
			document.getElementById('sipgatemenu').openPopup( document.getElementById('sipgateffx_loggedin'), "before_end", 0, 0, true);
		}, false);
		
		if(sgffx.getPref("extensions.sipgateffx.autologin","bool")) {
			this.login();
		}
		
		if(app=='thunderbird') {
			var threePane = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("mail:3pane");
			gBrowser = threePane.document.getElementById("messagepane");
		}

		gBrowser.addEventListener("DOMContentLoaded", this.parseClick2Dial, false);
		gBrowser.addEventListener("DOMFrameContentLoaded", this.parseClick2DialFrame, false);
		_prepareArray();
	},

	onUnload: function() {

		sgffx.log('unload overlay');

		var allElements = [
			'showcreditmenuitem',
			'pollbalance',
			'showvoicemailmenuitem',
			'showphonebookmenuitem',
			'showsmsformmenuitem',
			'showphonenumberformmenuitem',
			'showhistorymenuitem',
			'showfaxmenuitem',
			'showitemizedmenuitem',
			'dialactivate',
			'item_logoff',
			'separator1',
			'separator2',
			'dialdeactivate',
			'item_logon',

			'sipgateffx_loggedout',
			'sipgateffx_loggedin',

			'BalanceText',

			'sipgateffx_c2dStatus',
			'sipgateffx_c2dStatusText',			
			'sipgatecmd_c2dCancellCall',
			
			'sipgatenotificationPanel',
			
			'sipgateffxEventsCall',
			'sipgateffxEventsFax',
			'sipgateffxEventsSMS'
		];

		sgffx.log('closing window, removing references to elements');
		for(var i = 0; i < allElements.length; i++)
		{
			sgffx.removeXulObjRef(allElements[i], document.getElementById(allElements[i]));
		}
		
	},
	
	login: function() {
		var retVal = sgffx.getSamuraiAuth();
		if (retVal.username == null || retVal.password == null) {
			window.openDialog('chrome://sipgateffx/content/options.xul', 'sipgatePrefs');
			return;
		}
		
		if (!sgffx.loggedOutByUser) {
			sgffx.login();
		}
	},

	logoff: function() {
		sgffx.logoff();
	},

	showContextMenu: function(event) {
		// show or hide the menuitem based on what the context menu is on
		// see http://kb.mozillazine.org/Adding_items_to_menus
		document.getElementById("context-sipgateffx-sendassms").disabled = !(gContextMenu.isTextSelected || gContextMenu.isContentSelected);
		
		// allow /,-,(,),.,whitespace and all numers in phonenumbers
		var browserSelection = getBrowserSelection().match(/^[^a-zA-Z]+$/);
		var niceNumber = '';
		
		if (browserSelection !== null) {
			niceNumber = sgffx.niceNumber(browserSelection);
		}
		
		if (browserSelection == null || niceNumber.length < 7) {
			document.getElementById("context-sipgateffx-sendTo").disabled = true;
			document.getElementById("context-sipgateffx-callTo").disabled = true;
		}
		else {
			document.getElementById("context-sipgateffx-sendTo").disabled = false;
			document.getElementById("context-sipgateffx-sendTo").label = this.strings.getFormattedString("sipgateffxContextSendTo", [niceNumber]);
			document.getElementById("context-sipgateffx-callTo").disabled = false;
			document.getElementById("context-sipgateffx-callTo").label = this.strings.getFormattedString("sipgateffxContextCallTo", [niceNumber]);
		}
		
		try {
			var host = content.document.location.host.toLowerCase();;
			if(sgffxDB.isBlacklisted(host)) {
				document.getElementById("context-sipgateffx-c2dblacklistEn").hidden = false;
				document.getElementById("context-sipgateffx-c2dblacklistDis").hidden = true;
			} else {
				document.getElementById("context-sipgateffx-c2dblacklistEn").hidden = true;
				document.getElementById("context-sipgateffx-c2dblacklistDis").hidden = false;
			}
		} catch(e) {
			//
		}		
	},

	onToolbarButtonCommand: function(e) {
		// just reuse the function above.  you can change this, obviously!
		sipgateffx.onMenuItemCommand(e);
	}, 
	
	onMenuItemCommand: function(e) {
		// borrowed from http://mxr.mozilla.org/firefox/source/browser/base/content/browser.js#4683
		var focusedWindow = document.commandDispatcher.focusedWindow;
		var selection = focusedWindow.getSelection().toString();
		var charLen = 160;
		
		if (selection) {
			if (selection.length > charLen) {
				// only use the first charLen important chars. see bug 221361
				var pattern = new RegExp("^(?:\\s*.){0," + charLen + "}");
				pattern.test(selection);
				selection = RegExp.lastMatch;
			}
			
			selection = selection.replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ");
		
			if (selection.length > charLen)
				selection = selection.substr(0, charLen);
		}
	
		window.openDialog('chrome://sipgateffx/content/sms.xul', 'sipgateSMS', 'chrome,centerscreen,resizable=yes,titlebar=yes,alwaysRaised=yes', selection);
	},

	onMenuItemContextSendTo: function(e) {
		// allow /,-,(,),.,whitespace and all numers in phonenumbers
		var browserSelection = getBrowserSelection().match(/^[\/\(\)\ \-\.\[\]\d]+$/);
		var niceNumber = '';

		if(browserSelection !== null) {
			niceNumber = sgffx.niceNumber(browserSelection);
		}
		
		window.openDialog('chrome://sipgateffx/content/sms.xul', 'sipgateSMS', 'chrome,centerscreen,resizable=yes,titlebar=yes,alwaysRaised=yes', '', '+'+niceNumber);
	},

	onMenuItemContextCallTo: function(e) {
		// allow /,-,(,),.,whitespace and all numers in phonenumbers
		var browserSelection = getBrowserSelection().match(/^[\/\(\)\ \-\.\[\]\d]+$/);
		var niceNumber = '';

		if(browserSelection !== null) {
			niceNumber = sgffx.niceNumber(browserSelection);
		}
		
		sgffx.click2dial(niceNumber);
	},

	onMenuItemContextCallCancel: function(e) {
		sgffx.cancelClick2Dial();
	},
	
	onMenuItemBlacklist: function(e, action) {
		try {
			var host = content.document.location.host.toLowerCase();
			if(action == 'disable') {
				sgffxDB.addBlacklisting(host);
				document.getElementById("context-sipgateffx-c2dblacklistEn").hidden = false;
				document.getElementById("context-sipgateffx-c2dblacklistDis").hidden = true;
			} else if(action == 'enable') {
				sgffxDB.removeBlacklisting(host);
				document.getElementById("context-sipgateffx-c2dblacklistEn").hidden = true;
				document.getElementById("context-sipgateffx-c2dblacklistDis").hidden = false;
			}
		} catch(e) {
			sgffx.log("sipgateFFX->overlay->onMenuItemBlacklist ERROR " + e);
		}
	},
	
	onMenuItemDoNotDisturb: function(e, action) {
		try {
			if(action == 'disable') {
				sgffx.setDoNotDisturb(false);
			} else if(action == 'enable') {
				sgffx.setDoNotDisturb(true);
			}
		} catch(e) {
			sgffx.log("sipgateFFX->overlay->onMenuItemDoNotDisturb ERROR " + e);
		}
	},
	
	onNotificationPopupClose: function(e) {
		try {
			sgffx.log('sipgateFFX->overlay->onNotificationPopupClose: requested');
			sgffx.runXulObjectCommand('sipgatenotificationPanel', 'hidePopup');
		} catch(e) {
			sgffx.log("sipgateFFX->overlay->onNotificationPopupClose ERROR " + e);
		}
	},
	
	onNotificationGotoEventlist: function(e) {
		try {
			this.onStatusbarCommand('showSitePage', 'history');
			this.onNotificationPopupClose();
		} catch(e) {
			sgffx.log("sipgateFFX->overlay->onNotificationGotoEventlist ERROR " + e);
		}
	},
	
	parseClick2Dial: function() {
		if (sgffx.getPref("extensions.sipgateffx.parsenumbers", "bool") && sgffx.isLoggedIn) {
			var host = '';
			try {
				host = content.document.location.host.toLowerCase();
			} catch(e) {
				//		
			}
			if(sgffxDB.isBlacklisted(host)) {
				// sgffx.log('isBlacklisted: The site "'+host+'" is blacklisted. Do not match for click2dial.');
				return;
			}
			sipgateffxPageLoaded();
		}
	},
	
	parseClick2DialFrame: function(evnt) {
		if (sgffx.getPref("extensions.sipgateffx.parsenumbers", "bool") && sgffx.isLoggedIn) {
			var host = '';
			try {
				host = evnt.target.contentDocument.location.host.toLowerCase();
			} catch(e) {
				//		
			}
			if(sgffxDB.isBlacklisted(host)) {
				// sgffx.log('isBlacklisted: The site "'+host+'" is blacklisted. Do not match for click2dial.');
				return;
			}
			sipgateffxPageLoaded(evnt.target.contentDocument);
		}
	},
	
	toggleClick2Dial: function() {
		if (content.frames.length <= 0) {
			sipgateffxPageLoaded();
		} else {
		    for (var i=0; i<content.frames.length; i++) {
		    	sipgateffxPageLoaded(content.frames[i].document);
		    }
		}
	},
  
	onStatusbarCommand: function(action, param) {
		switch (action) {
			case 'showSitePage':
				if (!sgffx.isLoggedIn) {
					sgffx.log("*** sipgateffx: showSitePage *** USER NOT LOGGED IN ***");
					return;
				}
				
				if(sgffx.systemArea == 'classic') {
					sgffx.log("*** sipgateffx->showSitePage: wrong system area");
					return;
				}		
				
				if(typeof(url[param]) == 'undefined') {
					sgffx.log("*** sipgateffx->showSitePage: no url for action");
					return;
				}		

				var protocol = 'https://';
				var httpServer = sgffx.sipgateCredentials.HttpServer.replace(/^www/, 'secure');

				var siteURL = protocol + httpServer + url[param];
				
				var dataString = 'username='+ encodeURIComponent(sgffx.username)+'&password='+ encodeURIComponent(sgffx.password);
				
				// POST method requests must wrap the encoded text in a MIME stream
				var stringStream = Components.classes["@mozilla.org/io/string-input-stream;1"].
				                   createInstance(Components.interfaces.nsIStringInputStream);
				stringStream.data = dataString;
				
				var postData = Components.classes["@mozilla.org/network/mime-input-stream;1"].
				               createInstance(Components.interfaces.nsIMIMEInputStream);
				postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
				postData.addContentLength = true;
				postData.setData(stringStream);
				
				var referrer = null;  
				var flags = Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE;  

				// open new tab or use already opened (by extension) tab:
				if ((typeof(gBrowser.selectedTab.id) != "undefined") && (gBrowser.selectedTab.id == "TabBySipgateFirefoxExtensionStatusbarShortcut")) {
					gBrowser.loadURIWithFlags(siteURL, flags, referrer, null, postData);  
				} else {
					var theTab = gBrowser.addTab(siteURL, referrer, null, postData);
					gBrowser.selectedTab = theTab;
					theTab.id = "TabBySipgateFirefoxExtensionStatusbarShortcut";
				}
				break;
				
			case 'openPrefs':
				window.openDialog('chrome://sipgateffx/content/options.xul', 'sipgatePrefs');
				break;
				
			case 'sendSMS':
				window.open('chrome://sipgateffx/content/sms.xul', 'sipgateSMS', 'chrome,centerscreen,resizable=yes,titlebar=yes,alwaysRaised=yes');
				break;
				
			case 'dialPhonenumber':
				window.open('chrome://sipgateffx/content/previewnumber.xul', 'sipgatePreviewnumber', 'chrome,centerscreen,resizable=yes,titlebar=yes,alwaysRaised=yes');
				break;
				
			case 'pollBalance':
				sgffx.getBalance(true);
				break;
				
			case 'logon':
				sgffx.loggedOutByUser = false;
				this.login();
				break;
				
			case 'logoff':
				sgffx.loggedOutByUser = true;
				this.logoff();
				break;
				
			case 'toggleClick2Dial':
				this.toggleClick2Dial();
				break;
				
			default:
				var text = "action: " + action + "\nparams: " + param + "\n";
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
				promptService.alert(window, 'No Target', text);
				break;
		}
		
	},
	
	echo: function(txt) {
		return txt;
	},
	
	$: function(name) {
		return document.getElementById(name);
	},
	
	dumpJson: function(obj) {
		var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
		                 .createInstance(Components.interfaces.nsIJSON);
		sgffx.log(nativeJSON.encode(obj));
	}
		
};
window.addEventListener("load", function(e) { sipgateffx.onLoad(e); }, false);
window.addEventListener("unload", function(e) { sipgateffx.onUnload(e); }, false); 

if(typeof "getBrowserSelection" != "function") {
	function getBrowserSelection() {
		return gBrowser.contentWindow.getSelection().toString();
	}
}
