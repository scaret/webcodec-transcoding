import {MP4Demuxer} from '../vendor/mp4_demuxer.js'

let lastVideoFrame = null;
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext('2d');
const ajustCanvas = function(config){
    canvas.width = config.displayWidth;
    canvas.height = config.displayHeight;
}

const drawFrame = async function (f){
    ctx.drawImage(f, 0, 0);
    f.close();
}

let cntHandleFrame = 0;
const handleFrame = function (f){
    // console.log("handleFrame", cntHandleFrame++, f);
    if (!lastVideoFrame
        || lastVideoFrame.displayWidth !== f.displayWidth
        || lastVideoFrame.displayHeight !== f.displayHeight
    ){
        ajustCanvas(f);
    }
    drawFrame(f);
}

let ac = null
let destination = null
function playAudioFrame(f){
    const {numberOfChannels, numberOfFrames, sampleRate} = f;
    // const audioBuffer = ac.createBuffer(numberOfChannels, numberOfFrames, sampleRate);
    const buffer = new AudioBuffer({
        length: numberOfFrames,
        numberOfChannels,
        sampleRate,
    });
    for (let planeIndex = 0; planeIndex < numberOfChannels; planeIndex++){
        const size = f.allocationSize({ planeIndex});
        const data = new ArrayBuffer(size);
        f.copyTo(data, { planeIndex: planeIndex });

        buffer.getChannelData(planeIndex).set(new Float32Array(data));
    }

    const sourceNode = ac.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.start(0);
    sourceNode.connect(destination);
}

let cntHandleAudioFrame = 0;
const handleAudioFrame = function (f){
    // console.log("handleAudioFrame", cntHandleAudioFrame++, f);
    playAudioFrame(f);
}

let demuxer = new MP4Demuxer("./v/oceans.mp4");
window.demuxer = demuxer;

let videoDecoder = new VideoDecoder({
    output: handleFrame,
    error: function(){
        console.error("XXX", arguments)
    },
});
window.videoDecoder = videoDecoder;


let audioDecoder = new AudioDecoder({
    output: handleAudioFrame,
    error: function(){
        console.error("XXX", arguments)
    },
});
window.videoDecoder = videoDecoder;


const trackStates = {
    // {p, cnt, }
}

let videoPlayed = false;
let enableAudio = true;
let enableVideo = true;
const main = async ()=>{
    ac = new AudioContext();
    window.ac = ac;
    destination = new MediaStreamAudioDestinationNode(ac);
    window.destination = destination;
    document.getElementById("audio").srcObject = destination.stream;

    const config = await demuxer.getConfig();
    const info = await demuxer.source.getInfo();
    console.log("config", config);

    console.log("info", info);
    // console.log("info", JSON.stringify(info, null, 2));

    enableAudio = document.getElementById("enableAudio").checked
    enableVideo = document.getElementById("enableVideo").checked

    videoDecoder.configure(config);
    const audioDecoderConfig = {
        codec: info.audioTracks[0].codec,
        numberOfChannels: info.audioTracks[0].audio.channel_count,
        sampleRate: info.audioTracks[0].audio.sample_rate,
    };
    console.log("audioDecoderConfig", audioDecoderConfig)
    audioDecoder.configure(audioDecoderConfig)
    demuxer.start(async (chunk, trackInfo) => {
        let trackState = trackStates[trackInfo.id];
        if (!trackState){
            trackState = {
                trackInfo: trackInfo,
                cnt: 0,
                p: Promise.resolve(),
            }
            trackStates[trackInfo.id] = trackState;
        }
        let index = trackState.cnt++;
        trackState.p = trackState.p.then(()=>{
            return new Promise((resolve)=>{
                // console.log("demuxer onChunk", trackInfo.type, index, chunk);
                if (enableVideo && trackInfo.type === "video"){
                    // console.log("chunk", chunk)
                    videoDecoder.decode(chunk);
                    if (!videoPlayed){
                        videoPlayed = true;
                        document.getElementById("video").play()
                    }
                    setTimeout(()=>{
                        resolve();
                    }, chunk.duration * 1000 / trackInfo.timescale);
                }else if (enableAudio && trackInfo.type === "audio"){
                    // console.log("chunk", chunk.data.byteLength, chunk, "trackInfo", trackInfo);
                    if (!videoPlayed){
                        videoPlayed = true;
                        document.getElementById("video").play()
                    }
                    audioDecoder.decode(chunk);
                    // console.log("chunk", chunk)
                    setTimeout(()=>{
                        resolve();
                    }, chunk.byteLength * 1000 * (trackInfo.audio.sample_size / 8) * trackInfo.audio.channel_count / trackInfo.audio.sample_rate);
                }
            })
        })
    })
}

document.getElementById("start").onclick = main;
