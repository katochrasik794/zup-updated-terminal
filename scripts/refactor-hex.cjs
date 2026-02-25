const fs = require('fs');
const path = require('path');

const directory = './src/components';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

function refactorFile(filePath) {
    if (!filePath.match(/\.(tsx|ts|jsx|js)$/)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // 1. bg-black -> bg-background
    // This is generally safe as black backgrounds in dark mode should be white in light mode.
    content = content.replace(/bg-black(?=[\s'"`}])/g, 'bg-background');

    // 2. text-white -> text-foreground (Smartly)
    // We only replace text-white if it's NOT explicitly on a primary/success/danger background.
    content = content.replace(/text-white(?=[\s'"`}])/g, (match, offset, fullText) => {
        const start = Math.max(0, offset - 150);
        const end = Math.min(fullText.length, offset + 150);
        const context = fullText.slice(start, end);
        
        // If it's a button or explicit badge that stays colored, keep it white.
        if (context.match(/bg-(primary|success|danger|info|blue-|red-|green-|purple-|amber-|yellow-600|indigo-)/i)) {
            return 'text-white';
        }
        
        // Also keep it white if it's inside a code block or specific icon that should stay white?
        // For now, assume it should flip.
        return 'text-foreground';
    });

    // 3. text-white/opacity -> text-foreground/opacity
    content = content.replace(/text-white\/([0-9]+)/g, (match, opacity, offset, fullText) => {
        const start = Math.max(0, offset - 150);
        const end = Math.min(fullText.length, offset + 150);
        const context = fullText.slice(start, end);
        if (context.match(/bg-(primary|success|danger|info|blue-|red-|green-|purple-|amber-|indigo-)/i)) {
            return match;
        }
        return `text-foreground/${opacity}`;
    });

    // 4. border-white/opacity -> border-foreground/opacity (Usually subtle borders)
    content = content.replace(/border-white\/([0-9]+)/g, 'border-foreground/$1');
    
    // 5. hover:text-white -> hover:text-foreground
    content = content.replace(/hover:text-white/g, 'hover:text-foreground');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

walkDir(directory, refactorFile);
console.log('Smart refactoring complete');
