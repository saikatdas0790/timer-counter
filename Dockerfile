# The build/ directory is produced by the devcontainer CI step before this
# image is built. No node build stage needed here.
FROM nginx:alpine

COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
