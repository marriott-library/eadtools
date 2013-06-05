// Keeps track of upload box ids
var next_upload_id = 0;

// Checks whether contentdm fields have been loaded
var fields_loaded = false;

// Object for creating diffs
var dmp = new diff_match_patch();

// Settings from config.php
var cdm_server;
var cdm_weburl;
var cdm_alias;

// Entry point
function onload(alias, server, weburl) {
	var dropbox = document.body;
	dropbox.addEventListener("dragenter", dragenter, false);
	dropbox.addEventListener("dragover", dragover, false);
	dropbox.addEventListener("drop", drop, false);
	
	cdm_server = server;
	cdm_weburl = weburl;
	
	// Load the default collection 
	change_collection(alias);
}

function dragenter(e) {
	e.stopPropagation();
	e.preventDefault();
}

function dragover(e) {
	e.stopPropagation();
	e.preventDefault();
}

function drop(e) {
	e.stopPropagation();
	e.preventDefault();
	
	// Check for loaded fields
	if(!fields_loaded)
		return;

	// Get list of files from drop
	var files = e.dataTransfer.files;
	if(files) {
		var good_file = false;
		
		// Process each file
		for(i = 0; i < files.length; i++) {
			file = files[i];
			
			// Check for xml files
			if(file.type == "text/xml") {
				
				// Load xml into a string
				var reader = new FileReader();
				reader.onload = 
				(function(f) {
					return function(e) {
					
						// Get xml data
						var xml_string = e.target.result;

						// Get mapped fields from EAD
						var map = parse_ead_file(xml_string);
						
						// Check for valid EAD parsing
						if(map != undefined) {
			
							// Create new upload element
							var upload_id = create_upload(map, f.name, f.size, xml_string);
						
							// Populate upload box with existing metadata pulled from contentdm based on dmrecord
							populate_existing(upload_id, map["Collection Number"]);
						}
					};
				})(file);
				
				reader.readAsText(file);
				good_file = true;
			}
			else {
				log_message(file.name + " is not an XML file.");
			}
		}

		// At least one was good
		if(good_file) {
			show_collection_dropdown(false);
		}
	}
	else
		log_message("Unable to get list of files. Your browser probably doesn't support HTML5 file drag-and-drop.");
}

// Toggle the collection dropdown menu and drag text
function show_collection_dropdown(show) {
	if(show) {
		document.getElementById("dragtext").style.visibility = "visible";
		document.getElementById("collections").style.visibility = "visible";
		document.getElementById("body").style.visibility = "hidden";
	}
	else {
		document.getElementById("dragtext").style.visibility = "hidden";
		document.getElementById("collections").style.visibility = "hidden";
		document.getElementById("body").style.visibility = "visible";
	}
}

// Change the collection being edited and reload collection fields
function change_collection(alias) {
	cdm_alias = alias;
	document.getElementById("dragtext").innerHTML = "loading collection fields...";
	
	// Clear out old fields
	fields_loaded = false;
	for(item in config_fields) {
		config_fields[item] = undefined;
	}
	
	// Get new collection fields
	get_collection_fields(alias);
}

// Grab collection info from contentdm
function get_collection_fields(alias) {
	var url = "xmlwrap.php?url=" + encodeURIComponent(cdm_server + "/dmwebservices/index.php?q=dmGetCollectionFieldInfo/" + alias + "/xml");
	
	request = new XMLHttpRequest();
	request.open("GET",  url, true);
	request.onreadystatechange = function() {
		
		// Data has finished loading
		if(this.readyState == this.DONE) {
			
			try {
				var xml = this.responseXML;
				if(xml == null) {
					log_message(this.response);
					return;
				}
				
				// Get nice names of fields
				var fields = xml.getElementsByTagName("name")
				
				// Get nick names of fields
				var nicks = xml.getElementsByTagName("nick")
				
				// Build map of fields. nicename=>nickname
				for(var i = 0; i < fields.length; i++) {
					var nicename = fields[i].textContent;
					var nickname = nicks[i].textContent;
					if(nicename in config_fields)
						config_fields[nicename] = nickname;
				}
			}
			catch(e) {
				log_message("Exception thrown in function get_collection_fields: " + e.toString());
			}
			
			// Set program ready for use
			document.getElementById("dragtext").innerHTML = "drag files anywhere to the screen";
			fields_loaded = true;
		}
	};
	
	request.send();
}

// Pulls data from contentdm given an "identi" field and populates an upload box
// Step 1: run dmQuery to get a dmrecord given an "identi" value
// Step 2: run dmGetItemInfo to get the metadata given a dmrecord value
function populate_existing(upload_id, identifier) {
	var dmrecord = -1;
	
	request = new XMLHttpRequest();
	request.open("GET", "xmlwrap.php?url=" + encodeURIComponent(cdm_server + "/dmwebservices/index.php?q=dmQuery/" + cdm_alias + "/identi^" + identifier + "^exact^and/title!identi/title/5/1/0/0/0/0/xml"), true);
	request.onreadystatechange = function() {
		
		// Data has finished loading
		if(this.readyState == this.DONE) {
			
			try {
				var xml = this.responseXML;
				
				// Get number of records found by query
				var total = xml.getElementsByTagName("total")[0].textContent;
				
				// If it's found, grab the record number, otherwise indicate that it's a new EAD file.
				if(total > 0)
					dmrecord = xml.getElementsByTagName("pointer")[0].textContent;
			}
			catch(e) {
				log_message("Exception thrown in function populate_existing: " + e.toString());
			}
			
			// If the record is found then look up the metadata
			if(dmrecord != -1)
				load_existing_metadata(upload_id, dmrecord);
			else {
				set_status(upload_id, "No existing metadata found. Treating file as new.", "yellow");
				//document.getElementById(upload_id + "_submit").disabled = false;
			}
		}
	};
	
	request.send();
}

// Get metadata from contentdm and populate an upload box using dmrecord
function load_existing_metadata(upload_id, dmrecord) {
	var url = "xmlwrap.php?url=" + encodeURIComponent(cdm_server + "/dmwebservices/index.php?q=dmGetItemInfo/" + cdm_alias + "/" + dmrecord + "/xml");

	request = new XMLHttpRequest();
	request.open("GET", url, true);
	request.onreadystatechange = function() {
		
		// Data has finished loading
		if(this.readyState == this.DONE) {
			if(this.status == 200 && this.responseXML != null) {
				var xml = this.responseXML;
				
				// Loop through contentdm fields
				for(field in config_fields) {
					nick = config_fields[field];
					element = xml.getElementsByTagName(nick);
					
					// Found the nickname in the xml
					if(element.length) {
						
						// Get DOM elements						
						try {
							var ead = document.getElementById(upload_id + "_" + element[0].nodeName);
							var existing = document.getElementById(upload_id + "_e_" + element[0].nodeName);

							// Since contentDM sends back html-encoded text, we need to decode it
							existing_value = decode_html(element[0].textContent);
							
							// Get diff	between old and new
							var diff = dmp.diff_main(existing_value, ead.innerHTML);
							var diff_html = dmp.diff_prettyHtml(diff);
							
							// Show table cell
							existing.innerHTML = diff_html;
							existing.parentNode.style.display = "table-cell";
						}
						catch(e) {
							log_message("Exception thrown in function load_existing_metadata: " + e.toString());
						}
					}
				}
				
				// Show header for last column
				var existing_header = document.getElementById(upload_id + "_eh");
				existing_header.style.display = "table-cell";
				
				// Set link
				var existing_link = document.getElementById(upload_id + "_el");
				existing_link.href = cdm_weburl + "/cdm/singleitem/collection/" + cdm_alias + "/id/" + dmrecord;

				// Set dmrecord
				var submit_button = document.getElementById(upload_id + "_submit");
				submit_button.dataset["dmrecord"] = dmrecord;
				submit_button.value = "Submit Changes";
				submit_button.disabled = false;
				
				// Set status
				set_status(upload_id, "Existing metadata loaded with dmrecord " + dmrecord, "green");
			}
			else {
				log_message("Unable to look up item info with dmrecord: " + dmrecord + ". HTTP Status " + this.status);
			}
		}
	};

	request.send();
}

// Create a new upload element from a map array
function create_upload(map, filename, filesize, xml_string) {
	var upload_id = next_upload_id;
	var prefix = upload_id + "_";
	
	// Create new upload element
	var upload = document.createElement("div");
	upload.id = prefix + "upload";
	upload.className = "upload";
	
	// Append to uploads element
	var uploads = document.getElementById("uploads");
	uploads.appendChild(upload);

	// Create header for box
	var header = document.createElement("div");
	header.innerHTML = filename + ' | ' + (filesize / 1024).toFixed(2) + 'KB' + ' | <a href="#" onclick="remove_upload(' + upload_id + ');">Hide</a>';
	header.className = "header";
	upload.appendChild(header);
		
	// Create status box for messages
	var status = document.createElement("div");
	status.id = prefix + "status";
	status.className = "status green";
	status.innerHTML = "XML data loaded. Searching for existing metadata...";
	upload.appendChild(status);
	
	// Create submit button which also contains data about the upload
	var submit = document.createElement("input");
	submit.id = prefix + "submit";
	submit.type = "button";
	submit.value = "Submit New File (Disabled until OCLC Catcher service supports uploads)";
	submit.disabled = true;
	submit.dataset["upload_id"] = upload_id;
	submit.dataset["dmrecord"] = -1;
	submit.dataset["xmlstring"] = xml_string;
	submit.addEventListener("click", function() {
		if(confirm("Submit data?"))
			send_upload(this.dataset["upload_id"]);
	}, false);
	
	upload.appendChild(submit);

	// Create table
	var table = document.createElement("table");
	upload.appendChild(table);
	
	// Add table header
	add_field_header(table, prefix);
	
	// Add fields
	for(field in config_fields)
		add_field(table, prefix, field, config_fields[field], map[field]);
	
	// Increment upload id
	next_upload_id++;
	
	// Return newly created upload_id
	return upload_id;
}

// Remove an upload box
function remove_upload(upload_id) {
	var uploads = document.getElementById("uploads");
	var upload = document.getElementById(upload_id + "_upload");
	uploads.removeChild(upload);
	
	// Show collection dropdown instead of blank screen
	if(uploads.childNodes.length == 0)
		show_collection_dropdown(true);
}

// Adds the upload field header
function add_field_header(container, prefix) {
	
	// Create container row
	var row = document.createElement("tr");
	container.appendChild(row);

	// Create cells and attach to row
	var cell_label = document.createElement("th");
	var cell_ead = document.createElement("th");
	var cell_existing = document.createElement("th");

	// Set up field header
	cell_label.innerHTML = "Fields";
	row.appendChild(cell_label);

	// Set up EAD header
	cell_ead.innerHTML = "Data extracted from EAD file";
	row.appendChild(cell_ead);

	// Set up existing header
	cell_existing.style.display = "none";
	cell_existing.id = prefix + "eh";
	row.appendChild(cell_existing);

	// Create link to metadata
	var existing_link = document.createElement("a");
	existing_link.id = prefix + "el";
	existing_link.innerHTML = "Existing metadata";
	existing_link.target = "_blank";
	cell_existing.appendChild(existing_link);
}

// Add a field to an upload box
//  container: element object of the parent container (table)
//  prefix: upload id prefix before each element id/name
//  name: nice name of field
//  nick: nick name of field
//  value: value from EAD xml file
function add_field(container, prefix, name, nick, value) {
	
	// Create container row
	var row = document.createElement("tr");
	row.id = prefix + "r_" + nick;
	container.appendChild(row);

	// Create cells and attach to row
	var cell_label = document.createElement("td");
	var cell_ead = document.createElement("td");
	var cell_existing = document.createElement("td");
	row.appendChild(cell_label);
	row.appendChild(cell_ead);
	row.appendChild(cell_existing);

	// Create field elements
	cell_label.innerHTML = name;
	cell_label.className = "label";
	
	// Add ead field
	var ead = document.createElement("div");
	ead.id = prefix + nick;
	ead.className = "ead";
	if(value != undefined)
		ead.innerHTML = value;
	cell_ead.appendChild(ead);
	
	// Add existing metadata cell but hide until metadata is loaded
	var div_existing = document.createElement("div");
	div_existing.id = prefix + "e_" + nick;
	div_existing.className = "existing";
	cell_existing.appendChild(div_existing);
	cell_existing.style.display = "none";
}

// Parse EAD xml file using XPath. Returns a map of nickname=>values
function parse_ead_file(xml_string) {
	
	// Parse xml
	try {
		var parser = new DOMParser();
		var xml = parser.parseFromString(xml_string, "text/xml");
		
		// Check for errors
		var error = xml.getElementsByTagName("parsererror");
		if(error.length) {
			log_message("Error parsing XML: " + error[0].textContent);
			return undefined;
		}
	}
	catch(e) {
		log_message("Exception thrown in function parse_ead_file: " + e.toString());
		return undefined;
	}

	// Create map of metadata values using contentdm field names as keys
	var map = {};
	
	// Run XPath to get data from ead file
	for(query in config_queries) {
		map[config_queries[query]] = get_xml_values(query, map[config_queries[query]], xml);
	}
	
	// Convert date to contentdm format
	map["Date"] = convert_date(map["Date"]);
	
	// Set source field manually
	map["Format.xml"] = "ead";
	
	// Copy over UMAbroad and UMAnarrow to Subject
	if(map["SubjectBroad"] != undefined)
		map["Subject"] += "; UMAbroad--" + map["SubjectBroad"];
	if(map["SubjectNarrow"] != undefined)
		map["Subject"] += "; UMAnarrow--" + map["SubjectNarrow"];
	
	return map;
}

// Run an XPath query on an xml object and append the results in a semicolon delimited string to "values".
function get_xml_values(xpath_query, values, xml) {
	
	// Run XPath query
	try {
		var iterator = xml.evaluate(xpath_query, xml, namespace_resolver, XPathResult.ANY_TYPE, null);
		
		// Grab values from xpath result
		var node = iterator.iterateNext();
		while(node) {
			
			// Grab text and clean it
			var text = clean_text(node.textContent);
			
			// Append text if it's available
			if(text != "") {
				if(values == undefined)
					values = text;
				else
					values += "; " + text;
			}
			
			// Get next element
			node = iterator.iterateNext();
		}
	}
	catch(e) {
		log_message("Exception thrown in function get_xml_values: " + e.toString());
	}
	
	return values;
}

// Convert date into contentdm format
function convert_date(text) {
	
	// Check for valid text
	if(!text)
		return text;
	
	// Determine if date is a range
	ranges = text.split("/");
	switch(ranges.length) {
		case 1:
			return text;
		break;
		case 2:
			var new_date = "";
			
			// Split by dash to get year
			startsplit = ranges[0].split("-");
			endsplit = ranges[1].split("-");
			
			// Build semicolon separated list of dates
			var start_year = startsplit[0];
			var end_year = endsplit[0];
			while(start_year <= end_year) {
				new_date += start_year + "; ";
				start_year++;
			}
			
			return new_date;
		break;
		default:
			return text;
		break;
	}
}

// Removes endline characters and extra spaces
function clean_text(text) {
	
	return text.replace(/[\f\n\r\t\v]/g, "").replace(/ {2,}/g, " ").replace(/^\s+/, "").replace(/\s+$/, "");
}

// Set ead as the namespace prefix for XPath queries
function namespace_resolver(prefix) {
	var namespace = {
		"ead" : config_eadnamespace,
	};
	
	return namespace[prefix] || null;
}

// Create a new message in the log window
function log_message(text) {
	
	// Create message
	var message = document.createElement("div");
	message.className = "message";
	
	// Create remove icon
	var icon = document.createElement("img");
	icon.src = "images/remove.png";
	icon.title = "Remove message";
	icon.addEventListener("click", function() { this.parentNode.parentNode.removeChild(this.parentNode); }, false);
	message.appendChild(icon);
	
	// Set message text
	var span = document.createElement("span");
	span.textContent = text;
	message.appendChild(span);
	
	// Add message to log
	document.getElementById("messages").appendChild(message);
	console.log(text);
}

// Sets an upload box's status
function set_status(upload_id, message, color) {
	var element = document.getElementById(upload_id + "_status");
	element.innerHTML = message;
	element.className = "status " + color;
}

// Submit an upload box for adding/editing metadata
function send_upload(upload_id) {
		
	// Get submit button element which contains more data about the upload
	var submit_button = document.getElementById(upload_id + "_submit");
	
	// Create request object
	var request = new XMLHttpRequest();
	request.open("POST", "upload.php");
	request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	(function(id, button) {
		request.onreadystatechange = function() {
			if(this.readyState == this.DONE) {
				
				// Parse response
				response = this.response;
				if(response.match(/Transaction ID:(.*)/))
					set_status(id, response, "green");
				else {
					set_status(id, response, "red");
					button.disabled = false;
				}
			}
		}
	})(upload_id, submit_button);
	
	// Build message
	var message = undefined;
	for(field in config_fields) {
		
		// Get key value pair
		nick = config_fields[field];
		nick_value = document.getElementById(upload_id + "_" + nick).innerHTML;
		pair = nick + "=" + encodeURIComponent(nick_value);
		
		// Append pair to message
		if(message == undefined)
			message = pair;
		else
			message += "&" + pair;
	}

	// Append dmrecord and xml file
	message += "&dmrecord=" + encodeURIComponent(submit_button.dataset["dmrecord"]);
	message += "&alias=" + cdm_alias;
	message += "&xmlstring=" + encodeURIComponent(submit_button.dataset["xmlstring"]);

	// Send request
	if(message != undefined) {
		set_status(upload_id, "Sending data... please wait.", "");
		submit_button.disabled = true;
		request.send(message);
	}
}

// javascript version of php's html_entity_decode
function decode_html(text) {
	var element = document.createElement('textarea');
	element.innerHTML = text;
	return element.value;
}
