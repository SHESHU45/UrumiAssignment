{{/*
Platform fullname
*/}}
{{- define "platform.fullname" -}}
store-platform
{{- end }}

{{/*
Common labels
*/}}
{{- define "platform.labels" -}}
app.kubernetes.io/name: store-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: store-platform
{{- end }}
