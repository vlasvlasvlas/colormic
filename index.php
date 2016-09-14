<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/html">
<head>
    <script type="text/javascript" src="jquery.js"></script>
    <script type="text/javascript" src="chroma.js"></script>
<style>
body {
background-color:#001f3f;
}
</style>

</head>
<body>



<canvas id="canvas" width="800" height="512" style="display: block; background-color: black ;"></canvas>

<script type="text/javascript">

    // create the audio context (chrome only for now)
    if (! window.AudioContext) {
        if (! window.webkitAudioContext) {
            alert('no audiocontext found');
        }
        window.AudioContext = window.webkitAudioContext;
    }

    var context = new AudioContext();

    var audioBuffer;
    var sourceNode;
    var analyser;
    var javascriptNode;

    // get the context from the canvas to draw on
    var ctx = $("#canvas").get()[0].getContext("2d");

    // create a temp canvas we use for copying
    var tempCanvas = document.createElement("canvas"),
        tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width=800;
    tempCanvas.height=512;

    // used for color distribution
    var hot = new chroma.ColorScale({


//        colors:['#000000','#f39800','#fcc800','#e5006a','#00479d','#0068b7'],
//        positions:[0, .20, .40, .60, .80, 1],
//http://clrs.cc/
colors:['#001f3f', '#0074D9','#7FDBFF','#39CCCC','#3D9970','#2ECC40','#01FF70','#FFDC00','#FF851B','#FF4136','#85144b','#F012BE','#B10DC9'],
positions:[0, .5, .10, .20, .32, .40, .48, .66, .74, .85, .90, .98, 1],
        mode:'rgb',
        limits:[0, 99]
    });

    // load the sound
    setupAudioNodes();
//    loadSound("song.mp3");


    function setupAudioNodes() {

        // setup a javascript node
        javascriptNode = context.createScriptProcessor(2048, 1, 1);
        // connect to destination, else it isn't called
        javascriptNode.connect(context.destination);


        // setup a analyzer
        analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0;
        analyser.fftSize = 2048;

        // create a buffer source node
        sourceNode = context.createBufferSource();
        sourceNode.connect(analyser);
        analyser.connect(javascriptNode);

        sourceNode.connect(context.destination);
    }

    // load the specified sound
    function loadSound(url) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        // When loaded decode the data
        request.onload = function () {

            // decode the data
            context.decodeAudioData(request.response, function (buffer) {
                // when the audio is decoded play the sound
                playSound(buffer);
            }, onError);
        }
        request.send();
    }


    function playSound(buffer) {
        sourceNode.buffer = buffer;
        sourceNode.start(0);
        sourceNode.loop = true;
    }

    navigator.getUserMedia = ( navigator.getUserMedia    || navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||navigator.msGetUserMedia);
var aCtx;
var analyser;
var microphone;
if (navigator.getUserMedia) {
    navigator.getUserMedia({audio: true}, function(stream) {
        aCtx = new webkitAudioContext();
        analyser = aCtx.createAnalyser();
        microphone = aCtx.createMediaStreamSource(stream);
        microphone.connect(analyser);
        //analyser.connect(aCtx.destination);
    }, function (){console.warn("Error getting audio stream from getUserMedia")});
  micRunning = false;
  $("#mic-start").addClass("disabled");
  $("#mic-stop").removeClass("disabled");

};

    // log if an error occurs
    function onError(e) {
        console.log(e);
    }

    // when the javascript node is called
    // we use information from the analyzer node
    // to draw the volume
    javascriptNode.onaudioprocess = function () {

        // get the average for the first channel
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);

        // draw the spectrogram
        if (sourceNode.playbackState == sourceNode.PLAYING_STATE) {
            drawSpectrogram(array);
        }


    }

    function drawSpectrogram(array) {

        // copy the current canvas onto the temp canvas
        var canvas = document.getElementById("canvas");

        tempCtx.drawImage(canvas, 0, 0, 800, 512);

        // iterate over the elements from the array
        for (var i = 0; i < array.length; i++) {
            // draw each pixel with the specific color
            var value = array[i];
            ctx.fillStyle = hot.getColor(value).hex();

            // draw the line at the right side of the canvas
            ctx.fillRect(800 - 800, 475 - i, 800, 475); //ultimos dos, medida del sector nuevo
        }

        // set translate on the canvas
        ctx.translate(-800, 0);
        // draw the copied image
        ctx.drawImage(tempCanvas, 0, 0, 800, 512, 0, 0, 800, 512);

        // reset the transformation matrix
        ctx.setTransform(1, 0, 0, 1, 0, 0);

    }

</script>

</body>
</html>
