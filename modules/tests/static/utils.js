
function formatXml(xmldom='') {

    if(!xmldom) return xmldom;

    const serializer = new XMLSerializer();
    let xml;
    try {
        xml = serializer.serializeToString(xmldom);
    }
    catch(err) {
        console.error(err)
        return xmldom
    }
    var formatted = '';
    var reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    var pad = 0;
    $.each(xml.split('\r\n'), function(index, node) {
        var indent = 0;
        if (node.match( /.+<\/\w[^>]*>$/ )) {
            indent = 0;
        } else if (node.match( /^<\/\w/ )) {
            if (pad != 0) {
                pad -= 1;
            }
        } else if (node.match( /^<\w[^>]*[^\/]>.*$/ )) {
            indent = 1;
        } else {
            indent = 0;
        }

        var padding = '';
        for (var i = 0; i < pad; i++) {
            padding += '  ';
        }

        formatted += padding + node + '\r\n';
        pad += indent;
    });

    return formatted;
}

function comment(text) {
    let sxml = $.trim(text);
    return `<!--\n${sxml}\n-->`;
}
function uncomment(text) {
    return $.trim(text.replace("<!--",'').replace("-->",''));
}