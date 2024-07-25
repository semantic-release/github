export default function isLatestRelease({ type, main }) {
    return type === 'release' && main
}
