<?php
require "password.php";
$link = mysqli_connect("localhost", "photo_distance", "photo_distance", $password) or die(mysqli_connect_error());

mysqli_query($link, "INSERT INTO wanted (`date`,`email`,`ip`,`size`,`paper`,`finish`,`quantity`,`layout`,`other`) VALUES
 $vals;") or die(mysqli_error($link));
