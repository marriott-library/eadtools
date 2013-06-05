<?
header("Content-type: text/xml");
$handle = fopen(urldecode($_GET["url"]), "r");
while(!feof($handle))
	echo fread($handle, 8192);
fclose($handle);
?>
