<?
	require_once("prereqs.php");
	
	// Look up upload info for a record
	function get_file_path($alias, $dmrecord) {
		global $config;
		$data = "";
		
		// Open API url
		$url = $config["cdm_server"] . "/dmwebservices/index.php?q=dmGetImageInfo/$alias/$dmrecord/xml";
		$handle = fopen($url, "r");
		while(!feof($handle))
			$data .= fread($handle, 8192);
		
		// Extract file name
		preg_match("/<filename>(.*)<\/filename>/", $data, $match);
		if(isset($match[1]))
			return $match[1];
		else
			return "";
	}
	
	// Create catcher object
	try {
		$catcher = new SoapClient($config["catcher_url"]);
	}
	catch(Exception $e) {
		echo $e->getMessage();
		exit;		
	}
	
	// Parse POST data
	$alias = "";
	$dmrecord = -1;
	$action = "add";
	$xmlstring = "";
	$metadata_list = array();
	foreach($_POST as $key=>$value) {
		switch($key) {
			case "dmrecord":
				if($value != -1) {
					$action = "edit";
					$dmrecord = $value;
					array_push($metadata_list, array("field"=>$key, "value"=>$value));
				}
			break;
			case "xmlstring":
				$xmlstring = $value;
			break;
			case "alias":
				$alias = $value;
			break;
			default:
				array_push($metadata_list, array("field"=>$key, "value"=>$value));
			break;
		}
	}

	// Build param list
	$params = array(
		'action'=>$action,
		'cdmurl'=>$config["cdm_server"],
		'username'=>$config["cdm_username"],
		'password'=>$config["cdm_password"],
		'license'=>$config["cdm_license"],
		'collection'=>$alias,
		'metadata'=>array('metadataList'=>$metadata_list)
	);
	$process = $catcher->processCONTENTdm($params);
	$response = $process->return;
	echo $response . "\n";
	
	// Attempt to overwrite file with new data
	if(strpos($response, "Edit initiated.")) {
		echo "\n";

		// Look up path to xml file
		$path = get_file_path($alias, $dmrecord);
		if($path == "") {
			echo "Unable to get filepath for dmrecord=$dmrecord and alias=$alias";
			exit;
		}
		
		// Check for file
		if(!file_exists($path)) {
			echo "$path does not exist.\n";
			exit;
		}

		// Overwrite file with new contents
		if(file_put_contents($path, $xmlstring))
			echo "$path updated successfully\n";
		else
			echo "Could not edit $path\n";
	}
?>
