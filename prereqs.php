<?
	// Check PHP prereqs for tool
	if(!ini_get("allow_url_fopen")) {
		echo "Error in php.ini configuration: allow_url_fopen needs to be set to On";
		exit;
	}
	
	// Check for config.php
	if(!file_exists("config.php")) {
		echo "Rename config.template.php to config.php and edit the settings";
		exit;
	}
	
	include("config.php");
?>
