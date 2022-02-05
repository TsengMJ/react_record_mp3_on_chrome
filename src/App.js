import logo from "./logo.svg";
import "./App.css";
import { useState } from "react";
import lamejs from "lamejs";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const RecordHandler = () => {
    if (isRecording) stopRecord();
    else startRecord();
  };

  const startRecord = () => {
    console.log("Start Record");
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        setStream(stream);
        const options = { mimeType: "audio/webm;codecs=opus" };
        let mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.addEventListener("dataavailable", (event) => {
          setAudioChunks((prev) => [...prev, event.data]);
        });

        mediaRecorder.start(100);
        setMediaRecorder(mediaRecorder);
        setIsRecording(true);
      });
  };

  const stopRecord = () => {
    console.log("Stop Record");
    mediaRecorder.addEventListener("stop", () => {
      let blob = new Blob(audioChunks, { type: "audio/webm" });

      const audioContext = new AudioContext();
      const fileReader = new FileReader();

      fileReader.onloadend = () => {
        const arrayBuffer = fileReader.result; // as ArrayBuffer;

        audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
          let MP3Blob = webmToMp3(audioBuffer);
          saveFile({ blob: MP3Blob, fileName: "example.mp3" });
          setAudioChunks([]);
        });
      };

      fileReader.readAsArrayBuffer(blob);
    });

    mediaRecorder.stop();
    stream.getTracks().forEach(function (track) {
      track.stop();
    });

    setIsRecording(false);
  };

  const saveFile = ({ blob, fileName }) => {
    let a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";

    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="App">
      <button onClick={RecordHandler}>{isRecording ? "Stop" : "Record"}</button>
    </div>
  );
}

function audioBufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const btwLength = buffer.length * numOfChan * 2 + 44;
  let btwArrBuff = new ArrayBuffer(btwLength);
  let btwView = new DataView(btwArrBuff);
  let btwChnls = [];
  let btwIndex;
  let btwSample;
  let btwOffset = 0;
  let btwPos = 0;

  setUint32(0x46464952); // "RIFF"
  setUint32(btwLength - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(btwLength - btwPos - 4); // chunk length

  function setUint16(data) {
    btwView.setUint16(btwPos, data, true);
    btwPos += 2;
  }

  function setUint32(data) {
    btwView.setUint32(btwPos, data, true);
    btwPos += 4;
  }

  for (btwIndex = 0; btwIndex < buffer.numberOfChannels; btwIndex++)
    btwChnls.push(buffer.getChannelData(btwIndex));

  while (btwPos < btwLength) {
    for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
      // interleave btwChnls
      btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); // clamp
      btwSample =
        (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; // scale to 16-bit signed int
      btwView.setInt16(btwPos, btwSample, true); // write 16-bit sample
      btwPos += 2;
    }
    btwOffset++; // next source sample
  }

  let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));
  let wavSamples = new Int16Array(
    btwArrBuff,
    wavHdr.dataOffset,
    wavHdr.dataLen / 2
  );

  return { wavHdr, wavSamples };
}

function wavToMp3(channels, sampleRate, samples) {
  let buffer = [];
  let mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  let remaining = samples.length;
  let samplesPerFrame = 1152;
  for (let i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
    let mono = samples.subarray(i, i + samplesPerFrame);
    let mp3buf = mp3enc.encodeBuffer(mono);
    if (mp3buf.length > 0) {
      buffer.push(new Int8Array(mp3buf));
    }
    remaining -= samplesPerFrame;
  }
  let d = mp3enc.flush();
  if (d.length > 0) {
    buffer.push(new Int8Array(d));
  }

  let mp3Blob = new Blob(buffer, { type: "audio/mp3" });

  return mp3Blob;
}

function webmToMp3(buffer) {
  const { wavHdr, wavSamples } = audioBufferToWav(buffer);
  const mp3Blob = wavToMp3(wavHdr.channels, wavHdr.sampleRate, wavSamples);

  return mp3Blob;
}

export default App;
