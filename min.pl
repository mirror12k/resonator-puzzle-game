#!/usr/bin/env perl
use strict;
use warnings;

use IO::File;
use MIME::Base64;

my $opt_js_minimize = 1;


`npm i uglify-js\@3.14.5`;


# read the html file
my $file = shift // die "html file required";
my $html = `cat $file`;

# get sources to inline
my @js_sources;
my @css_sources;
while ($html =~ m#(<script\b[^<>]+)src="([^"]+)"([^<>]*>)</script>#gs) {
	push @js_sources, $2;
	warn "inlining js file: $2";
}
while ($html =~ m#(<link\b[^<>]+\bhref="([^"]+\.css)"[^<>]*>)#gs) {
	push @css_sources, $2;
	warn "inlining css file: $2";
}
my $js_sources = join ' ', @js_sources;
my $css_sources = join ' ', @css_sources;

# remove the sourcing lines
$html =~ s#(<script\b[^<>]+)src="([^"]+)"([^<>]*>)</script>##gs;
$html =~ s#(<link\b[^<>]+\bhref="([^"]+\.css)"[^<>]*>)##gs;

# get the js and css
my $js_command = "cat $js_sources"
	. ($opt_js_minimize ? " | ./node_modules/uglify-js/bin/uglifyjs --mangle --compress --toplevel" : "");

my $js = `$js_command`;
my $js_raw .= `cat $js_sources`;
my $css_raw .= $css_sources ? `cat $css_sources` : '';


# inline asset files
my $file_inlines = '';
foreach my $arg ($js_raw =~ m#assets/[^'"]+\.png#sg) {
	warn "inlining image file: $arg";
	my $data = `cat $arg`;
	$file_inlines .= "<img style='display:none' data-url='$arg' src='data:image/png;base64," . encode_base64($data, '') . "' />\n";
}
foreach my $arg ($js_raw =~ m#assets/[^'"]+\.wav#sg) {
	warn "inlining audio file: $arg";
	my $data = `cat $arg`;
	$file_inlines .= "<audio style='display:none' data-url='$arg' src='data:audio/wav;base64," . encode_base64($data, '') . "' ></audio>\n";
}
foreach my $arg ($js_raw =~ m#lvls/[^'"]+\.(?:ldtk|json)#sg) {
	warn "inlining json file: $arg";
	my $data = `cat $arg`;
	$file_inlines .= "<script type='application/json' data-url='$arg'>$data</script>\n";
}
my @font_paths = ($css_raw =~ m#\.\./[^'"]+\.ttf#sg);
foreach my $arg (@font_paths) {
	my $path = $arg =~ s#\.\./#assets/#rs;
	warn "inlining font file: $path";
	my $data = `cat $path`;
	my $encoded_data = "data:audio/wav;base64," . encode_base64($data, '');
	my $q_arg = quotemeta $arg;
	$css_raw =~ s/$q_arg/$encoded_data/s;
}

# put everything together
$js = "<script>$js</script>";
my $css = $css_sources ? "<style>$css_raw</style>" : '';

# insert it before the head closing tag
die "failed to find <\/head> tag" unless $html =~ s#(<\/head>)#$js$css$file_inlines$1#s;

# output
print $html;

