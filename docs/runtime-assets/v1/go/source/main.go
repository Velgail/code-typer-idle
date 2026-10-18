// SPDX-License-Identifier: BSL-1.0
// Original Code Typer Idle adapter. Yaegi retains its Apache-2.0 license.
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"syscall/js"
	"unicode/utf8"

	"github.com/traefik/yaegi/interp"
)

const outputLimit = 64 * 1024

type limitedBuffer struct {
	bytes.Buffer
	truncated bool
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	n := len(p)
	remaining := outputLimit - b.Len()
	if len(p) > remaining {
		p = p[:remaining]
		b.truncated = true
	}
	_, _ = b.Buffer.Write(p)
	return n, nil
}

type emptyFS struct{}

func (emptyFS) Open(string) (fs.File, error) { return nil, fs.ErrNotExist }

type result struct {
	Stdout          string `json:"stdout"`
	Stderr          string `json:"stderr,omitempty"`
	Diagnostics     string `json:"diagnostics,omitempty"`
	Error           string `json:"error,omitempty"`
	ErrorKind       string `json:"errorKind,omitempty"`
	OutputTruncated bool   `json:"outputTruncated,omitempty"`
}

func packageExports(values map[string]interface{}) map[string]reflect.Value {
	out := make(map[string]reflect.Value, len(values))
	for name, value := range values {
		out[name] = reflect.ValueOf(value)
	}
	return out
}

// Register only memory-only packages needed by the exercises. In particular,
// os, net/http, syscall, unsafe, reflect and syscall/js are not script imports.
func safeExports(stdout *limitedBuffer) interp.Exports {
	return interp.Exports{
		"fmt/fmt": packageExports(map[string]interface{}{
			"Print":   func(values ...interface{}) (int, error) { return fmt.Fprint(stdout, values...) },
			"Printf":  func(format string, values ...interface{}) (int, error) { return fmt.Fprintf(stdout, format, values...) },
			"Println": func(values ...interface{}) (int, error) { return fmt.Fprintln(stdout, values...) },
			"Sprint":  fmt.Sprint, "Sprintf": fmt.Sprintf, "Sprintln": fmt.Sprintln, "Errorf": fmt.Errorf,
		}),
		"math/math": packageExports(map[string]interface{}{
			"Abs": math.Abs, "Ceil": math.Ceil, "Floor": math.Floor, "Round": math.Round,
			"Trunc": math.Trunc, "Min": math.Min, "Max": math.Max, "Pow": math.Pow,
			"Sqrt": math.Sqrt, "Mod": math.Mod, "Sin": math.Sin, "Cos": math.Cos,
			"Pi": math.Pi, "E": math.E,
		}),
		"strings/strings": packageExports(map[string]interface{}{
			"Contains": strings.Contains, "Count": strings.Count, "HasPrefix": strings.HasPrefix,
			"HasSuffix": strings.HasSuffix, "Index": strings.Index, "Join": strings.Join,
			"Repeat": strings.Repeat, "Replace": strings.Replace, "ReplaceAll": strings.ReplaceAll,
			"Split": strings.Split, "SplitN": strings.SplitN, "ToLower": strings.ToLower,
			"ToUpper": strings.ToUpper, "Trim": strings.Trim, "TrimSpace": strings.TrimSpace,
			"TrimPrefix": strings.TrimPrefix, "TrimSuffix": strings.TrimSuffix,
			"Compare": strings.Compare, "Fields": strings.Fields,
		}),
		"sort/sort": packageExports(map[string]interface{}{
			"Ints": sort.Ints, "Strings": sort.Strings, "Float64s": sort.Float64s,
			"SearchInts": sort.SearchInts, "SearchStrings": sort.SearchStrings,
			"IntsAreSorted": sort.IntsAreSorted, "StringsAreSorted": sort.StringsAreSorted,
		}),
		"strconv/strconv": packageExports(map[string]interface{}{
			"Atoi": strconv.Atoi, "Itoa": strconv.Itoa, "FormatInt": strconv.FormatInt,
			"ParseInt": strconv.ParseInt, "FormatFloat": strconv.FormatFloat,
			"ParseFloat": strconv.ParseFloat, "ParseBool": strconv.ParseBool,
			"FormatBool": strconv.FormatBool, "Quote": strconv.Quote, "Unquote": strconv.Unquote,
		}),
		"errors/errors": packageExports(map[string]interface{}{
			"New": errors.New, "Is": errors.Is, "As": errors.As,
		}),
		"unicode/utf8/utf8": packageExports(map[string]interface{}{
			"RuneCountInString": utf8.RuneCountInString, "ValidString": utf8.ValidString,
			"DecodeRuneInString": utf8.DecodeRuneInString, "RuneLen": utf8.RuneLen,
			"RuneError": utf8.RuneError, "RuneSelf": utf8.RuneSelf,
		}),
	}
}

func evaluate(source string) (out result) {
	var stdout, stderr limitedBuffer
	phase := "compile"
	defer func() {
		out.Stdout, out.Stderr = stdout.String(), stderr.String()
		out.OutputTruncated = stdout.truncated || stderr.truncated
		if failure := recover(); failure != nil {
			out.Error = fmt.Sprint(failure)
			out.ErrorKind = phase
		}
	}()
	instance := interp.New(interp.Options{
		Stdin: strings.NewReader(""), Stdout: &stdout, Stderr: &stderr,
		Args: []string{"exercise"}, Env: []string{}, GoPath: "/unavailable",
		SourcecodeFilesystem: emptyFS{}, Unrestricted: false,
	})
	if err := instance.Use(safeExports(&stdout)); err != nil {
		out.Error = err.Error()
		out.ErrorKind = "compile"
		return
	}
	program, err := instance.Compile(source)
	if err != nil {
		out.Diagnostics = err.Error()
		out.Error = "Go compilation failed"
		out.ErrorKind = "compile"
		return
	}
	phase = "runtime"
	if _, err := instance.Execute(program); err != nil {
		out.Diagnostics = err.Error()
		out.Error = "Go execution failed"
		out.ErrorKind = "runtime"
	}
	return
}

func main() {
	js.Global().Set("codeTyperGoExecute", js.FuncOf(func(_ js.Value, args []js.Value) interface{} {
		source := ""
		if len(args) > 0 {
			source = args[0].String()
		}
		encoded, err := json.Marshal(evaluate(source))
		if err != nil {
			return `{"stdout":"","error":"result encoding failed"}`
		}
		return string(encoded)
	}))
	select {}
}
