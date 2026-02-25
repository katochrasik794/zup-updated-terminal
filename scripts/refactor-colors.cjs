const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        let fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('src/components');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Replace hardcoded hexes with standard classes
    content = content.replace(/bg-\[\#2a2f36\]/g, 'bg-gray-800');
    content = content.replace(/hover:bg-\[\#363c45\]/g, 'hover:bg-gray-700');
    content = content.replace(/border-\[\#2a2f36\]/g, 'border-gray-800');
    content = content.replace(/text-\[\#8b9096\]/g, 'text-gray-400');
    content = content.replace(/text-\[\#b2b5be\]/g, 'text-gray-300');
    content = content.replace(/text-\[\#9ca3af\]/g, 'text-gray-400');
    content = content.replace(/hover:bg-\[\#363c47\]/g, 'hover:bg-gray-700');

    // Explicit white bypass for primary colored buttons so they don't turn black
    // Look for bg-primary text-white and replace with bg-primary text-[#ffffff]
    content = content.replace(/text-white(.*?)bg-primary/g, 'text-[#ffffff]$1bg-primary');
    content = content.replace(/bg-primary(.*?)text-white/g, 'bg-primary$1text-[#ffffff]');
    content = content.replace(/bg-success(.*?)text-white/g, 'bg-success$1text-[#ffffff]');
    content = content.replace(/bg-danger(.*?)text-white/g, 'bg-danger$1text-[#ffffff]');
    content = content.replace(/bg-info(.*?)text-white/g, 'bg-info$1text-[#ffffff]');
    content = content.replace(/bg-\[\#FF5555\](.*?)text-white/g, 'bg-[#FF5555]$1text-[#ffffff]');
    content = content.replace(/bg-\[\#4A9EFF\](.*?)text-white/g, 'bg-[#4A9EFF]$1text-[#ffffff]');
    content = content.replace(/bg-\[\#2962ff\](.*?)text-white/g, 'bg-[#2962ff]$1text-[#ffffff]');

    if (content !== original) {
        fs.writeFileSync(file, content);
    }
});
console.log('Refactoring complete');
