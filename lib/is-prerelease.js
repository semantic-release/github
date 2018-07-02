module.exports = ({type, channel}) => type === 'prerelease' || (type === 'release' && Boolean(channel));
