
// function to get distance between 2 points
async function matrixAPIcall(origins, destinations) {
  try {
    const response = await axios.get(
      'http://www.mapquestapi.com/directions/v2/route',
      {
        params: {
                    //remove key for security purpose
          key: '',
          from: origins,
          to: destinations,
        },
      }
    );

    let distance = response.data.route.distance;
    let destNarrative = response.data.route.legs[0].destNarrative;
    let duration = response.data.route.legs[0].formattedTime;
    let turns = response.data.route.legs[0].maneuvers.length;

    return { distance, destNarrative, duration, turns };
  } catch (error) {
    throw error.message;
  }
}

// Function to get charge station by its ID
async function getMinimumCS(chargeStationId) {
  try {
    const response = await axios.get(
      'https://chargepoints.dft.gov.uk/api/retrieve/registry/format/json',
      {
        params: {
          'device-id': chargeStationId,
        },
      }
    );
    // console.log(response.data);
    return response.data;
  } catch (error) {
    throw error.message;
  }
}

async function listChargeStations(lat, long, dist, charger) {
  try {
    return await axios.get(
      'https://chargepoints.dft.gov.uk/api/retrieve/registry/format/json',
      {
        params: {
          lat,
          long,
          dist,
          'rated-output-kw': charger,
        },
      }
    );
  } catch (error) {}
}

// function to calculate the distance between 2 points
function calcClosestDistance(lat1, long1, lat2, long2) {
  const toRad = (number) => number * (Math.PI / 180);

  lat1 = parseFloat(lat1);
  long1 = parseFloat(long1);
  lat2 = parseFloat(lat2);
  long2 = parseFloat(long2);

  var R = 3958.8; // miles
  var x1 = lat2 - lat1;
  var dLat = toRad(x1);
  var x2 = lon2 - lon1;
  var dLon = toRad(x2);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


var map = L.map('map').setView([57.11973723727868, -2.13965135269459], 17);

mapTiler = L.tileLayer(
  'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
  {
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken:
      'pk.eyJ1IjoiamFkb25uazUwIiwiYSI6ImNsMHgzb3IzcTFnaGIzZG41OHJpbWNhd3YifQ.iRmUKqleOXpk27nXvL-zkA',
  }
);

mapTiler.addTo(map);

var LeafIcon = L.Icon.extend({
  options: {
    iconSize: [38, 40],
  },
});

var greenIcon = new LeafIcon({
  iconUrl: 'Assets/evcharger2.png',
  popupAnchor: [-1, 3],
});

var redIcon = new LeafIcon({
  iconUrl: 'Assets/evcharger.png',
});

var TransparentIcon = new LeafIcon({
  iconUrl: 'Assets/evcharger3.png',
});

var jstart;
var jfinish;
var SOC;
var EVrange;
var charger;
var safeDrivableDistance;
var evDrivableDistance;
var StartLat;
var StartLong;
var EndLat;
var EndLong;
var chargerSpeed;
var chargingDuration;
var evBatterySize;
var chargeLat;
var chargeLong;



// get Journey planner Form
const journeyForm = document.getElementById('journey');

// add listener to the form
journeyForm.addEventListener('submit', JourneyForm);

//getting the form data
function JourneyForm(event) {
  event.preventDefault();
  console.log('form submitted');

  //getting the form data
  jstart = document.getElementById('journeystart').value;
  jfinish = document.getElementById('journeyfinish').value;
  SOC = document.getElementById('evSOC').value;
  evBatterySize = document.getElementById('evBatterySize').value;
  EVrange = document.getElementById('EVrange').value;
  charger = document.getElementById('charger').value;
  chargingDuration = document.getElementById('chargeDUration').value;

  // console.log(jstart + ' is start, '+ jfinish + ' is finish, ' + SOC + '% is departure charge, ' + EVrange + ' miles is EVrange, ' + evBatterySize  + " is EV battery size " + chargingDuration + ' is Charge Duration, '+ charger + " is Chosen Charger ")

  document.getElementById('journey').reset();

  //manipulation of form data.
  SOC = SOC / 100;

  evDrivableDistance = EVrange * SOC;
  // console.log(evDrivableDistance +' miles is the Drivable Range')
  //Subtract 10% battery power from the CBP for allowance.
  SOC = SOC - 0.1;

  //calculate the safe Drivable Range of the EV (DR) using the SOC minus 10%.
  safeDrivableDistance = EVrange * SOC; 
  // console.log(safeDrivableDistance +' miles is the safe Drivable Range')

  //preferred duration divided by 60 to get the time in hours.
  chargingDuration = chargingDuration / 60;

  newMapLayer();
}

//Geocode the start point and locate it on the map
async function StartPoint(location) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: location,
          key: '',
        },
        //remove key for security reasons
      }
    );
    // Log full response
    // console.log(response);

    // get the Geometry
    StartLat = response.data.results[0].geometry.location.lat;
    StartLong = response.data.results[0].geometry.location.lng;
    var FormattedAd = response.data.results[0].formatted_address;
    startPointGeo = [StartLat, StartLong];

    // console.log(FormattedAd);
    // console.log(StartLong);
    L.marker([StartLat, StartLong], {
      draggable: true,
      title: 'Start Point',
    })
      .addTo(map)
      .bindPopup(FormattedAd);

    return startPointGeo;
  } catch (error) {
    throw error.message;
  }
}

//Geocode the end point and locate it on the map
async function EndPoint(location) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: location,
          key: 'AIzaSyAKf5i0oElPYrydoQFUiu5k7oBUrR2oIys',
        },
      }
    );
    // console.log(response);

    // get the Geometry
    EndLat = response.data.results[0].geometry.location.lat;
    EndLong = response.data.results[0].geometry.location.lng;
    var FormattedAd = response.data.results[0].formatted_address;
    endPointGeo = [EndLat, EndLong];

    L.marker([EndLat, EndLong], {
      icon: redIcon,
      draggable: true,
      title: 'End Point',
    })
      .addTo(map)
      .bindPopup(FormattedAd);

    return endPointGeo;
  } catch (error) {
    throw error.message;
  }
}

//add new map layer

async function newMapLayer() {
  try {
    map.remove();

    map = L.map('map').setView([57.11973723727868, -2.13965135269459], 17);
    mapTiler.addTo(map);

    var startPointGeo = await StartPoint(jstart);
    var endPointGeo = await EndPoint(jfinish);

    startPointGeo = L.latLng(startPointGeo);
    endPointGeo = L.latLng(endPointGeo);
    bounds = L.latLngBounds(startPointGeo, endPointGeo);

    map.fitBounds(bounds, {
      padding: [50, 50],
    });

    //call the matrix api to calculate the journey distance: between the start point and end point
    let journeyDistance = await matrixAPIcall(jstart, jfinish);

    if (journeyDistance <= safeDrivableDistance) {
      routeAPIcall(jstart, jfinish);

      Swal.fire(
        'EV Charge Sufficient!',
        'Your EV can complete this journey without a stop',
        'success'
      );
      // run the routing function
    } else if (journeyDistance > safeDrivableDistance) {
      while (journeyDistance > safeDrivableDistance) {
        let chargePoint = await chargestations();

        journeyDistance = await matrixAPIcall(chargePoint, jfinish);
      }
    }
  } catch (error) {
    throw error.message;
  }
}


//ChargeStations function that will calculate the closest chargestation to the destination and locate it on the map
async function chargestations() {
  try {
    const response = await listChargeStations(
      StartLat,
      StartLong,
      safeDrivableDistance,
      charger
    );

    let distance = [];

    for (i in response.data.ChargeDevice) {
      const toRad = (number) => number * (Math.PI / 180);

      var lat2 = EndLat;
      var lon2 = EndLong;
      var lat1 = response.data.ChargeDevice[i].ChargeDeviceLocation.Latitude;
      var lon1 = response.data.ChargeDevice[i].ChargeDeviceLocation.Longitude;

      var R = 3958.8; // miles
      var x1 = lat2 - lat1;
      var dLat = toRad(x1);
      var x2 = lon2 - lon1;
      var dLon = toRad(x2);
      var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      var d = R * c;

      distance.push({
        lat: lat1,
        long: lon1,
        miles: d,
        csID: response.data.ChargeDevice[i].ChargeDeviceId,
      });
    }

    let min = Math.min(...distance.map((item) => item.miles));
    let getMinimum = distance.filter((item) => item.miles === min)[0];

    // console.log(getMinimum);

    var actualChargeStation = await getMinimumCS(getMinimum.csID);
    var chargeSt = actualChargeStation.ChargeDevice[0];
    var ChargeDeviceName = chargeSt.ChargeDeviceName;
    var ChargeDeviceStreet = chargeSt.ChargeDeviceLocation.Address.Street;
    var ChargeDevicePostCode = chargeSt.ChargeDeviceLocation.Address.PostCode;
    var ChargeDevicePostTown = chargeSt.ChargeDeviceLocation.Address.PostTown;
    var ChargeDeviceStatus = chargeSt.ChargeDeviceStatus;
    var numberOfConnectors = chargeSt.Connector.length;
    var ConnectorRatedOutputkW = [];
    for (var i = 0; i < numberOfConnectors; i++) {
      ConnectorRatedOutputkW.push(chargeSt.Connector[i].RatedOutputkW);
    }
    chargerSpeed = Math.max(...ConnectorRatedOutputkW);
    // console.log(ConnectorRatedOutputkW)
    // console.log(chargerSpeed)

    chargeLat = getMinimum.lat;
    chargeLong = getMinimum.long;
    let chargePoint = [chargeLat, chargeLong];

    chargePoint = chargePoint.toString();

    // console.log(chargePoint);

    L.marker([chargeLat, chargeLong], {
      icon: greenIcon,
    }).addTo(map).bindPopup(`
    <div>
      <div><strong>${ChargeDeviceName}</strong></div>
      <div>${ChargeDeviceStreet}, ${ChargeDevicePostCode}</div>
      <div>${ChargeDevicePostTown}</div>
      <div>Status: ${ChargeDeviceStatus}</div>
      <div>${numberOfConnectors} Connectors</div>
      <div>Avail KWh: ${ConnectorRatedOutputkW}</div>
    </div>
    `);
    chargeDuration();

    return chargePoint;
  } catch (error) {
    throw error.message;
  }
}

//Calculate the preferred time to be spent on each charging station and how it affects the next distance.
function chargeDuration() {
  chargerSpeed; //from the CS charging RatedOutput in KWh (Kilowatts per Hour)

  //the replenish Charge will
  var batteryReplenished = chargerSpeed * chargingDuration;
  // console.log(chargingDuration + "hours");
  // console.log(batteryReplenished + "kWh");

  //percentage replenished is:
  var percentageReplenished = batteryReplenished / evBatterySize;
  // console.log(percentageReplenished * 100 + '% is percentage charged')

  StartLat = chargeLat;
  StartLong = chargeLong;
  safeDrivableDistance = percentageReplenished * EVrange;
}

function itinerary() {
  const itineraryDiv = document.getElementById('itinerary-div');
  const newDiv = document.createElement('div');
  const newList = document.createElement('ul');
  console.log('add');
  itineraryDiv.appendChild(newDiv);
  newDiv.id = 'itineraryId';
  itineraryId.appendChild(newList);
}

async function routeAPIcall(origins, destinations) {
  try {
    const response = await matrixAPIcall(origins, destinations);
    // axios.get(
    //   'http://www.mapquestapi.com/directions/v2/route',
    //   {
    //     params: {
    //       key: 'GDt292YcfGH8Pj8J3UNYMLKhFJOC0kUL',
    //       from: origins,
    //       to: destinations,
    //     },
    //   }
    // );

    let distance = response.data.route.distance;
    let destNarrative = response.data.route.legs[0].destNarrative;
    let duration = response.data.route.legs[0].formattedTime;
    let turns = response.data.route.legs[0].maneuvers.length;
    let route = [];
    for (var i = 0; i < turns; i++) {
      route.push(response.data.route.legs[0].maneuvers[i].startPoint);
    }

    var latlngs = route;
    var polyline = L.polyline(latlngs, { color: '#33031f' })
      .addTo(map)
      .bindPopup(
        `
    <div>
      <div><strong> ${destNarrative} </strong></div>
      <div>Duration: Hr ${duration} Sec</div>
      <div>Distance: ${distance} mi</div>
    </div>
    `
      )
      .openPopup();

    // console.log(response.data)
  } catch (error) {
    throw error.message;
  }
}


// TODO
// get Initial distance by calling the matrixAPIcall function
// initDist = Dest - Or in miles
// get initial safe driveable distance = x
// find chargeStations around the iSDD
// 
// find currentDistance = initDist - sDD