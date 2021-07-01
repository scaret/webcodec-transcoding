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
    console.log("handleFrame", cntHandleFrame++, f);
    if (!lastVideoFrame
        || lastVideoFrame.displayWidth !== f.displayWidth
        || lastVideoFrame.displayHeight !== f.displayHeight
    ){
        ajustCanvas(f);
    }
    drawFrame(f);
}

let demuxer = new MP4Demuxer("./v/oceans.mp4");

let decoder = new VideoDecoder({
    output: handleFrame,
    error: function(){
        console.error("XXX", arguments)
    },
});
window.decoder = decoder;

let p = Promise.resolve();

let clockRate = 24000;

let videoPlayed = false;

const main = async ()=>{
    const config = await demuxer.getConfig();
    console.log("config", config);

    decoder.configure(config);
    let cnt = 0;
    demuxer.start(async (chunk) => {
        const index = cnt;
        cnt++;
        p = p.then(()=>{
            return new Promise((resolve)=>{
                console.log("demuxer onChunk", index, chunk);
                decoder.decode(chunk);
                if (!videoPlayed){
                    videoPlayed = true;
                    document.getElementById("video").play()
                }
                setTimeout(()=>{
                    resolve();
                }, chunk.duration * 1000 / clockRate);
            })
        })
    })
}
main();