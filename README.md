# React Record MP3 file on Chrome

## Introduction
A while ago, I was helping [DWAVE](https://dwave.cc/) develop a web service for recording and labeling. One of the requirements is that the files that have been recorded successfully can be downloaded into MP3 or WAV format.Since it was the first time I deal with a sound-related case, and there were not many problems with the audio file page on the Internet, I spent more time than I expected to solve this problem.But the most annoying thing is that **Chrome does not support output to MP3 or WAV format by default!**, in order to achieve the format that end users can download in MP3 or WAV, the method I will provide later in this article is to output from Chrome to WEBM format, and then convert it to WAV and MP3 format in sequence.



## Steps
1. Install dependency.
```bash=
yarn add lamejs@1.2.0
```

2. Ask the user for microphone permission, this function will return a Promise with a stream as parameter for later steps to use.
```javascript=
navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then((stream) => { ... })
```

3. Create MediaRecorder and feed the stream obtained in the previous step into the MediaRecorder Constructor.
```javascript=
...
.then((stream) => {
    const options = { mimeType: "audio/webm;codecs=opus" };
    let mediaRecorder = new MediaRecorder(stream, options);  
})
```

4. Define the function that receives the data stream after starting the recording.
```javascript=
mediaRecorder.addEventListener("dataavailable", (event) => {
    setAudioChunks((prev) => [...prev, event.data]); // setAudioChucks is a global function created from useState()
})

```

5. Define the function for subsequent data processing after the recording is ended. And after the processing, download the audio file to the local file system (MP3Blob and saveFile functions will be defined in later steps).
```javascript=
mediaRecorder.addEventListener("stop", () => {
    var blob = new Blob(audioChunks, { type: "audio/webm" });

    const audioContext = new AudioContext();
    const fileReader = new FileReader();

    fileReader.onloadend = () => {
        const arrayBuffer = fileReader.result; 

        audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
            var MP3Blob = webmToMp3(audioBuffer); // will transform original webm format to mp3 format, and it will be defined later.
            saveFile({ blob: MP3Blob, fileName: "example.mp3" }); // export recorded file to localhost, and will be defined later.
            setAudioChunks([]);
        });
    };

    fileReader.readAsArrayBuffer(blob);
});

```

6. Define the aforementioned webmToMp3 function（audioBufferToWav and wavToMp3 functions will be defined in later steps）.
```javascript=
function webmToMp3(buffer) {
    const { wavHdr, wavSamples } = audioBufferToWav(buffer); // will be defined later
    const mp3Blob = wavToMp3(wavHdr.channels, wavHdr.sampleRate, wavSamples); // will be defined later

    return mp3Blob;
}
```

7. Define the aforementioned audioBufferToWav function.
```javascript=
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
    
    setUint32(0x46464952); 
    setUint32(btwLength - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(btwLength - btwPos - 4);

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
            btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); 
            btwSample =
            (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; 
            btwView.setInt16(btwPos, btwSample, true);
            btwPos += 2;
        }
        btwOffset++;
    }

    let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));
    let wavSamples = new Int16Array(
        btwArrBuff,
        wavHdr.dataOffset,
        wavHdr.dataLen / 2
    );

    return { wavHdr, wavSamples };
}
```

8. Define the aforementioned wavToMp3 function.
```javascript=
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

```

9. Define the aforementioned saveFile function.
```javascript=
function saveFile({ blob, fileName }) {
    let a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";

    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
};

```

Hope this blog can help you solve your problem. 

In the future, I will create a package to handle the above things, and I will update it when it is completed~

## More
See hole example code on [Github](https://github.com/TsengMJ/react_record_mp3_on_chrome)
