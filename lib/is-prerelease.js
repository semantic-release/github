export default ({type, main}) => type === 'prerelease' || (type === 'release' && !main);
