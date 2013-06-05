<? include("prereqs.php"); ?>
<!DOCTYPE HTML>
<html>
	<head>
		<title>EAD Tool</title>
		<meta charset="utf-8">
		<link type="text/css" rel="stylesheet" href="css/main.css" />
		<script src="js/diff_match_patch.js"></script><!-- http://code.google.com/p/google-diff-match-patch/ | modified original by removing hardcoded style="" and <span> tags -->
		<script src="js/config.js"></script>
		<script src="js/main.js"></script>
	</head>
	<body onload="onload('<?=$config["cdm_collections"][0]?>', '<?=$config["cdm_server"]?>', '<?=$config["cdm_weburl"]?>');">
		<div id="dropbox">
			<div id="collections">
				Edit collection
				<select id="collection_list" onchange="change_collection(this.value)">
					<? foreach($config["cdm_collections"] as $collection) { ?>
					<option value="<?=$collection?>"><?=$collection?></option>
					<? } ?>
				</select>
			</div>
			<h1 id="dragtext">loading collection fields...</h1>
		</div>
		<div id="body">
			<div id="uploads"></div>
		</div>
		<div id="messages"></div>
	</body>
</html>
