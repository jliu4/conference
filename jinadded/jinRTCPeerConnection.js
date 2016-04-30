'use strict';

var MyPeerConnection = function(options) {
    var optional = {
        optional: []
    };
     

    console.debug('optional-arguments', JSON.stringify(optional.optional, null, '\t'));

    var peer = new RTCPeerConnection(iceServersObject,optional);

    peer.onicecandidate = function(event) {
        if (event.candidate) {
            options.onICE(event.candidate);
        }
    };

     
    if (options.attachStream) peer.addStream(options.attachStream);

    if (options.attachStreams && options.attachStream.length) {
        var streams = options.attachStreams;
        for (var i = 0; i < streams.length; i++) {
            peer.addStream(streams[i]);
        }
    }

    peer.onaddstream = function(event) {
        setTimeout(function() {
            var remoteMediaStream = event.stream;

            remoteMediaStream.onended = function() {
                if (options.onRemoteStreamEnded) options.onRemoteStreamEnded(remoteMediaStream);
            };
  
            if (options.onRemoteStream) options.onRemoteStream(remoteMediaStream);

                console.debug('on:add:stream', remoteMediaStream);
        }, 2000);
    };
        
    var OfferToReceiveAudio = false;
    var OfferToReceiveVideo = false;
    if(peer.getLocalStreams()[0] && peer.getLocalStreams()[0].getAudioTracks().length) {
        OfferToReceiveAudio = true;
    }
        
    if(peer.getLocalStreams()[0] && peer.getLocalStreams()[0].getVideoTracks().length) {
        OfferToReceiveVideo = true;
    }
          
    var sdpConstraints = options.constraints || {
        mandatory: {
            OfferToReceiveAudio: OfferToReceiveAudio,
            OfferToReceiveVideo: OfferToReceiveVideo
        }
    };
            
    console.debug('sdp-constraints', JSON.stringify(sdpConstraints, null, '\t'));

    function createOffer() {
        if (!options.onOfferSDP) return;

        peer.createOffer(function(sessionDescription) {
            sessionDescription.sdp = setBandwidth(sessionDescription.sdp);
            peer.setLocalDescription(sessionDescription);
            options.onOfferSDP(sessionDescription);

            console.debug('offer-sdp', sessionDescription.sdp);
        }, onSdpError, sdpConstraints);
    }

    function createAnswer() {
        if (!options.onAnswerSDP) return;

            //options.offerSDP.sdp = addStereo(options.offerSDP.sdp);
        console.debug('offer-sdp', options.offerSDP.sdp);
        peer.setRemoteDescription(new RTCSessionDescription(options.offerSDP), onSdpSuccess, onSdpError);
        peer.createAnswer(function(sessionDescription) {
            sessionDescription.sdp = setBandwidth(sessionDescription.sdp);
            peer.setLocalDescription(sessionDescription);
            options.onAnswerSDP(sessionDescription);
            console.debug('answer-sdp', sessionDescription.sdp);
        }, onSdpError, sdpConstraints);
    }

        // options.bandwidth = { audio: 50, video: 256, data: 30 * 1000 * 1000 }
    var bandwidth = options.bandwidth;

    function setBandwidth(sdp) {
        if (!bandwidth /* || navigator.userAgent.match( /Android|iPhone|iPad|iPod|BlackBerry|IEMobile/i ) */ ) return sdp;

            // remove existing bandwidth lines
        sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');

        if (bandwidth.audio) {
            sdp = sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + bandwidth.audio + '\r\n');
        }
        if (bandwidth.video) {
            sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.video + '\r\n');
        }

        if (bandwidth.data) {
            sdp = sdp.replace(/a=mid:data\r\n/g, 'a=mid:data\r\nb=AS:' + bandwidth.data + '\r\n');
        }

        return sdp;
    }

        // DataChannel management
    var channel;

    if (!!options.onChannelMessage) {
        peer.ondatachannel = function(event) {
            channel = event.channel;
            setChannelEvents();
        };
        openOffererChannel();
    }
        
    createOffer();
    createAnswer();

    function openOffererChannel() {
        channel = peer.createDataChannel(options.channel || 'RTCDataChannel', {});
        setChannelEvents();
    }

    function setChannelEvents() {
        channel.onmessage = function(event) {
            if (options.onChannelMessage) options.onChannelMessage(event);
        };

        channel.onopen = function() {
            if (options.onChannelOpened && !options.onChannelOpenInvoked) {
                options.onChannelOpenInvoked = true;
                options.onChannelOpened(channel);
            }
        };
        channel.onclose = function(event) {
            if (options.onChannelClosed) options.onChannelClosed(event);

            console.warn('WebRTC DataChannel closed', event);
        };
        channel.onerror = function(event) {
            if (options.onChannelError) options.onChannelError(event);

            console.error('WebRTC DataChannel error', event);
        };
    }

    function onSdpSuccess() {}

    function onSdpError(e) {
        console.error('onSdpError:', JSON.stringify(e, null, '\t'));
    }

    return {
        addAnswerSDP: function(sdp) {
            console.debug('adding answer-sdp', sdp.sdp);
            peer.setRemoteDescription(new RTCSessionDescription(sdp), onSdpSuccess, onSdpError);
        },
        addICE: function(candidate) {
            peer.addIceCandidate(new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                candidate: candidate.candidate
            }));

            console.debug('adding-ice', candidate.candidate);
        },

        peer: peer,
        channel: channel,
        sendData: function(message) {
            channel && channel.send(message);
        }
    };
};

function listenEventHandler(eventName, eventHandler) {
    window.removeEventListener(eventName, eventHandler);
    window.addEventListener(eventName, eventHandler, false);
}

var loadedIceFrame;

function loadIceFrame(callback) {
    if (loadedIceFrame) {
        return;
    }

    loadedIceFrame = true;

    var iframe = document.createElement('iframe');
    iframe.onload = function() {
        iframe.isLoaded = true;

        listenEventHandler('message', iFrameLoaderCallback);

        function iFrameLoaderCallback(event) {
            if (!event.data || !event.data.iceServers) {
                return;
            }
            callback(event.data.iceServers);

            // this event listener is no more needed
            window.removeEventListener('message', iFrameLoaderCallback);
        }

        iframe.contentWindow.postMessage('get-ice-servers', '*');
    };
    iframe.src = 'https://cdn.webrtc-experiment.com/getIceServers/';
    iframe.style.display = 'none';
    (document.body || document.documentElement).appendChild(iframe);
}

var iceServers = [];

iceServers.push({
    url: 'stun:stun.l.google.com:19302'
});

iceServers.push({
    url: 'stun:stun.anyfirewall.com:3478'
});

iceServers.push({
    url: 'turn:turn.bistri.com:80',
    credential: 'homeo',
    username: 'homeo'
});

iceServers.push({
    url: 'turn:turn.anyfirewall.com:443?transport=tcp',
    credential: 'webrtc',
    username: 'webrtc'
});

var iceServersObject = {
    iceServers: iceServers
};

loadIceFrame(function (iceServers) {
    iceServersObject.iceServers = iceServersObject.iceServers.concat(iceServers);
});

