
var elevator;
var map;
var chart;
var tracks = {};

var currentPathName;


// Load the Visualization API and the columnchart package.
google.load('visualization', '1', {packages: ['corechart']});


function newPath(pathName) {
    currentPathName = pathName;
    
    if(tracks[currentPathName] ) {        
        map.fitBounds(tracks[currentPathName].bounds);
        drawPath();
    }
    else {
        tracks[currentPathName] = {};
    $.ajax({
           dataType: "json",
           url: "paths/" + pathName + '.json',
           success: function ( data ) {           
           tracks[currentPathName].path = [];
           var rawPath = data.coords;
           if(rawPath.length > 255) {
           var stepWidth = rawPath.length / 255;
           for (var i = 0; i < 255; i++) {
           var pos = Math.ceil(i * stepWidth);
           tracks[currentPathName].path[i] = new google.maps.LatLng(rawPath[pos][0],rawPath[pos][1]);
           }
           }
           else {
           for(var i = 0; i < rawPath.length; i++){
           tracks[currentPathName].path[i] = new google.maps.LatLng(rawPath[i][0],rawPath[i][1]);
           }
           }
           
           tracks[currentPathName].bounds = new google.maps.LatLngBounds();
           for(var i = 0; i < tracks[currentPathName].path.length; i++){
                tracks[currentPathName].bounds.extend(tracks[currentPathName].path[i]);
           }
           
           map.fitBounds(tracks[currentPathName].bounds);
           // Draw the path, using the Visualization API and the Elevation service.
           drawPath();
           
           }
           });
    }
}


function initialize() {
    var mapOptions = {
    zoom: 9,
    center: null,
    mapTypeId: 'terrain'
    }
    
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    // Create an ElevationService.
    elevator = new google.maps.ElevationService();
    
    
    newPath($('#path').find(":selected").val());
    
    // register callback to path select
    $('#path').change(function() {
                      newPath($(this).find(":selected").val());
                      });
    
    // register callback to checkboxes
    $('#heatmap').change(toggleHeatmap);
    $('#rollercoasterA').change(function(){toggleHeightsAsLines('rollercoasterA');});
    $('#rollercoasterB').change(function(){toggleHeightsAsLines('rollercoasterB');});
    $('#hedgehog').change(function(){toggleHeightsAsLines('hedgehog');});
    $('#zickzack').change(function(){toggleHeightsAsLines('zickzack');});
    
    // Create a new chart in the elevation_chart DIV.
    chart = new google.visualization.ScatterChart($('#elevation_chart')[0]);
    // Register a listener to be notified once the dashboard is ready.
    google.visualization.events.addListener(chart, 'onmouseover', function(e){ tracks[currentPathName].marker.setPosition(tracks[currentPathName].elevationPath[e.row]);});

    
}

function drawPath() {
    

    if(tracks[currentPathName].elevationChartData) {
        chart.draw(tracks[currentPathName].elevationChartData, tracks[currentPathName].elevationChartOptions);
        plotInfoBox();
    }
    else {
        
        // Create a PathElevationRequest object using this array.
        // Ask for 256 samples along that path.
        var pathRequest = {
            'path': tracks[currentPathName].path,
            'samples': 256
        }
        
        // Initiate the path request.
        elevator.getElevationAlongPath(pathRequest, elevatorCallback);
    }
}

function elevatorCallback(results,status){
    if (status != google.maps.ElevationStatus.OK) {
        return;
    }
    var elevations = results;
    tracks[currentPathName].elevations = [];
    tracks[currentPathName].elevationPath = [];
    tracks[currentPathName].distances = [0];
    tracks[currentPathName].totalPathLength2D = 0;
    tracks[currentPathName].totalPathLength3D = 0;
    tracks[currentPathName].minElevation = 9000;
    tracks[currentPathName].maxElevation = -1;
    tracks[currentPathName].weightedLocations = [];
    
    for (var i = 0; i < elevations.length - 1; i++) {
        // Extract the elevation samples from the returned results
        // and store them in an array of LatLngs.
        tracks[currentPathName].elevationPath.push(elevations[i].location);
        tracks[currentPathName].elevations.push(elevations[i].elevation);
        tracks[currentPathName].weightedLocations.push({location: elevations[i].location, weight: Math.abs(elevations[i].elevation - elevations[i+1].elevation)});
        
        // compute length in 2D and 3D space
        var dist = google.maps.geometry.spherical.computeDistanceBetween(elevations[i].location, elevations[i+1].location);
        
        tracks[currentPathName].totalPathLength2D += dist;
        tracks[currentPathName].distances.push(tracks[currentPathName].totalPathLength2D);
        if(elevations[i].elevation < tracks[currentPathName].minElevation) {
            tracks[currentPathName].minElevation = elevations[i].elevation;
        }
        else if (elevations[i].elevation > tracks[currentPathName].maxElevation){
            tracks[currentPathName].maxElevation = elevations[i].elevation;
        }
        
        tracks[currentPathName].totalPathLength3D += Math.sqrt( Math.pow(elevations[i].elevation - elevations[i+1].elevation, 2)
                                       + Math.pow(dist, 2));
    }
    
    // Display a polyline of the elevation path.
    var pathOptions = {
    path: tracks[currentPathName].elevationPath,
    strokeColor: '#0000CC',
    opacity: 0.4,
    map: map
    }
    tracks[currentPathName].polyline = new google.maps.Polyline(pathOptions);
    
    tracks[currentPathName].marker = new google.maps.Marker({
                                    position: tracks[currentPathName].elevationPath[0],
                                    map: map,
                                    title: 'Start'
                                    });
    
    
    
    // Extract the data from which to populate the chart.
    tracks[currentPathName].elevationChartData = new google.visualization.DataTable();
    
    tracks[currentPathName].elevationChartData.addColumn('number', 'Elevation');
    tracks[currentPathName].elevationChartData.addColumn('number', 'Distance');
    for (var i = 0; i < elevations.length; i++) {
        tracks[currentPathName].elevationChartData.addRow([tracks[currentPathName].distances[i]/1000, elevations[i].elevation]);
    }
    
    // Draw the chart using the data within its DIV.
    
    tracks[currentPathName].elevationChartOptions = {
    width:800,
    lineWidth: 3,
    pointSize: 0,
    hAxis: {title: 'Distance (km)', minValue: 0, maxValue: Math.ceil(tracks[currentPathName].distances[tracks[currentPathName].distances.length-1]/1000), gridlines:{count:Math.ceil(tracks[currentPathName].distances[tracks[currentPathName].distances.length-1]/1000)+1}},
    vAxis: {title: 'Elevation (m)', minValue: tracks[currentPathName].minElevation, maxValue: tracks[currentPathName].maxElevation},
    legend: 'none',
    tooltip:{trigger:'none'}
    };
    
    chart.draw(tracks[currentPathName].elevationChartData, tracks[currentPathName].elevationChartOptions);
    plotInfoBox();
    
}

function plotInfoBox() {
    
    $('#infoBox').html('Total path length in 2D: ' + Math.ceil(tracks[currentPathName].totalPathLength2D)/1000 + ' km'
    + '<br>' +
    'Total path length in 3D: ' + Math.ceil(tracks[currentPathName].totalPathLength3D)/1000 + ' km'
    + '<br>' +
    'Difference between 2D and 3D: ' + Math.ceil(tracks[currentPathName].totalPathLength3D-tracks[currentPathName].totalPathLength2D) + ' m'
    + '<br>' +
    'Difference in altitude: ' + Math.ceil(tracks[currentPathName].maxElevation - tracks[currentPathName].minElevation) + ' m'
    + '<br>' +
    'Minimum elevation: ' + Math.ceil(tracks[currentPathName].minElevation) + ' m'
    + '<br>' +
    'Maximum elevation: ' + Math.ceil(tracks[currentPathName].maxElevation) + ' m');
    
}


function toggleHeatmap(event) {
    if($(this).is(':checked'))
    {
        if(typeof tracks[currentPathName].heatmap == 'undefined') {            
            var pointArray = new google.maps.MVCArray(tracks[currentPathName].weightedLocations);
            tracks[currentPathName].heatmap = new google.maps.visualization.HeatmapLayer({ data: pointArray });
        }          
        tracks[currentPathName].polyline.setMap(null);
        tracks[currentPathName].heatmap.setMap(map);
    }
    else
    {
       tracks[currentPathName].polyline.setMap(map);
       tracks[currentPathName].heatmap.setMap(null);
    }   
}

function toggleHeightsAsLines(type) {
    
    if($('#'+type).is(':checked'))
    {
       
        if(typeof tracks[currentPathName][type + 'Heights'] == 'undefined') {
            
            
            tracks[currentPathName][type + 'Heights'] = new google.maps.Polyline({
                                                                               path: computeHeightsAsLines(type),
                                                                               strokeColor: '#0000FF',
                                                                               strokeOpacity: 1.0,
                                                                               strokeWeight: 2
                                                                               });
        }
        tracks[currentPathName].polyline.setMap(null);
        tracks[currentPathName][type + 'Heights'].setMap(map);
    }
    else
    {
        tracks[currentPathName].polyline.setMap(map);
        tracks[currentPathName][type + 'Heights'].setMap(null);
    }

}

function computeHeightsAsLines(type){
    var heightsAsLines = [];
    if(type == 'rollercoasterA' || type == 'rollercoasterB'){
        var center = tracks[currentPathName].bounds.getCenter();
        for(var i = 0; i < tracks[currentPathName].elevationPath.length; i++){
            var degrees;
            if(type == 'rollercoasterA'){
                degrees = 0;
            }
            else {
                degrees = google.maps.geometry.spherical.computeHeading(center, tracks[currentPathName].elevationPath[i]);
            }
            var peak = google.maps.geometry.spherical.computeOffset(tracks[currentPathName].elevationPath[i], tracks[currentPathName].elevations[i]-tracks[currentPathName].minElevation, degrees);
            heightsAsLines.push(peak);
            heightsAsLines.push(tracks[currentPathName].elevationPath[i]);
            heightsAsLines.push(peak);
        }
    }
    else if (type == 'hedgehog'){
        for(var i = 0; i < tracks[currentPathName].elevationPath.length - 1; i++){
            var degrees;
        
            degrees = google.maps.geometry.spherical.computeHeading(tracks[currentPathName].elevationPath[i], tracks[currentPathName].elevationPath[i+1]) + 90;
            
            var peak = google.maps.geometry.spherical.computeOffset(tracks[currentPathName].elevationPath[i], tracks[currentPathName].elevations[i]-tracks[currentPathName].minElevation, degrees);
            heightsAsLines.push(tracks[currentPathName].elevationPath[i]);
            heightsAsLines.push(peak);
            heightsAsLines.push(tracks[currentPathName].elevationPath[i]);

        }
    }
    else if (type == 'zickzack'){
        for(var i = 0; i < tracks[currentPathName].elevationPath.length - 1; i++){
            var degrees;
            
            degrees = google.maps.geometry.spherical.computeHeading(tracks[currentPathName].elevationPath[i], tracks[currentPathName].elevationPath[i+1]) + ((i%2 === 0)?90:-90);
            
            var peak = google.maps.geometry.spherical.computeOffset(tracks[currentPathName].elevationPath[i],
                                                                    Math.abs(tracks[currentPathName].elevations[i]-tracks[currentPathName].elevations[i+1])*5, degrees);
            
            heightsAsLines.push(peak);
            
            
        }
    }
    return heightsAsLines;
}




google.maps.event.addDomListener(window, 'load', initialize);
