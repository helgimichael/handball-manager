const imageExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.svg', '.gif'];
for (const ext of imageExtensions) {
  require.extensions[ext] = (module, filename) => {
    module.exports = { src: filename, height: 1080, width: 1920 };
  };
}

