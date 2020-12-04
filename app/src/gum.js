const DEFAULT_CONSTRAINTS = Object.freeze({
  audio: true,
  video: { width: 640, height: 480 },
  // video: false,
});

// Gets the users camera and returns the media stream
module.exports.GUM = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  console.log('Available devices', devices);
  return await navigator.mediaDevices.getUserMedia(DEFAULT_CONSTRAINTS);
};
